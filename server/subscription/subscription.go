// subscription provides the necessary funcions for handling subscriptions.
// If a client is subscribed to a document, they must be notified if that document
// is modified (changed or completely overwritten) or deleted. If a client is
// subscribed to a collection, they must be notified if a document in the collection
// is modified (changed or overwritten), a document is added to the collection, or a
// document is removed from the collection.
package subscription

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/document"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/skiplist"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// writeFlusher combines http.ResponseWriter and http.Flusher interfaces.
// It's used to enable event streaming capabilities.
type writeFlusher interface {
	http.ResponseWriter
	http.Flusher
}

// Subscribers type manages the skip list of subscribers.
// It contains a skip list mapping URLs to channels.
type Subscribers struct {
	// key: the url
	// value: the struct containing channel mapping to range
	content skiplist.SkipList[string, map[chan string]string]
}

// New creates and initializes a new Subscribers object.
// Returns a new instance of the Subscribers type.
func New() Subscribers {
	var list skiplist.SkipList[string, map[chan string]string]
	list.MakeSkipList()
	return Subscribers{
		content: list,
	}
}

// Serve manages the subscription process and set up channel to listen.
// w is the HTTP response writer.
// r is the incoming HTTP request.
// wg is a wait group that helps manage goroutines.
// bound specifies the range for which the subscription should occur.
func (s *Subscribers) Serve(w http.ResponseWriter, r *http.Request, wg *sync.WaitGroup, bound string) {
	// create channel
	channel := make(chan string)
	defer close(channel)

	path := r.URL.Path

	var chanRangeNew map[chan string]string
	val, exists := s.content.Find(path)
	if exists {
		chanRangeNew = val.GetVal()
		chanRangeNew[channel] = bound
	}

	check := func(key string, currVal map[chan string]string, exists bool) (newValue map[chan string]string, err error) {
		if !exists {
			// add map to skiplist
			chanRange := make(map[chan string]string)
			chanRange[channel] = bound
			return chanRange, nil
		}
		return chanRangeNew, nil
	}
	success, _ := s.content.Upsert(path, check)
	if !success {
		slog.Error("Adding channel map failed")
	}

	defer func() {
		val, _ := s.content.Find(path)
		chanRange := val.GetVal()
		delete(chanRange, channel)
	}()

	// Convert ResponseWriter to a writeFlusher
	wf, ok := w.(writeFlusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	slog.Info("Converted to writeFlusher")

	// Set up event stream connection
	wf.Header().Set("Content-Type", "text/event-stream")
	wf.Header().Set("Cache-Control", "no-cache")
	wf.Header().Set("Connection", "keep-alive")
	wf.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Last-Event-ID")
	wf.Header().Set("Access-Control-Allow-Origin", "*")
	wf.WriteHeader(http.StatusOK)
	wf.Flush()

	slog.Info("Sent headers")
	var first bool = true
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	// Run forever
	for {
		if first {
			wg.Done()
			first = false
		}
		select {
		case <-ticker.C:
			// ticker to keep the channel running
			wf.Write([]byte("15 sec\n"))
			slog.Info("15 sec\n")
			wf.Flush()
		case <-r.Context().Done():
			// client closed connection
			slog.Info("Client closed connection")
			return
		case upd := <-channel:
			// send updates
			var evt bytes.Buffer
			evt.WriteString(upd)
			slog.Info("Sending msg")
			// Send event
			wf.Write(evt.Bytes())
			wf.Flush()
		}
	}
}

// Notify sends notifications to the subscribers based on changes.
// notifyPath specifies the path where the change occurred.
// event is a string indicating the type of the event.
// data contains the data that is associated with the event.
func (s *Subscribers) Notify(notifyPath string, event string, data []byte) {
	urlPath := notifyPath
	// for db and collections:
	if strings.HasSuffix(urlPath, "/") {
		node, exist := s.content.Find(urlPath)
		if exist {
			val := node.GetVal()
			if strings.HasPrefix(string(data), "\"/") {
				s.send(event, data, urlPath, val, false, false)
			} else {
				s.send(event, data, urlPath, val, false, true)
			}

		}

	} else {
		// for doc

		// check if the collection has subsribers:
		colPath := filepath.Dir(urlPath) + string("/")
		colPath = strings.ReplaceAll(colPath, "\\", "/")
		node1, existColSub := s.content.Find(colPath)
		if existColSub {
			val := node1.GetVal()
			s.send(event, data, urlPath, val, true, false)
		}

		// check if the document has subsribers:
		node2, existDocSub := s.content.Find(urlPath)
		if existDocSub {
			val := node2.GetVal()
			s.send(event, data, urlPath, val, false, false)
		}

	}
	return
}

// send is an internal function responsible for sending notifications to the subscribers.
// event is a string indicating the type of the event.
// data contains the data that is associated with the event.
// path indicates the path where the change occurred.
// chanRange is a map from channels to their associated ranges.
// check is a flag that determines if the range should be checked before sending a notification.
// db is a flag that indicates if the data contains database entries or documents.
func (s *Subscribers) send(event string, data []byte, path string, chanRange map[chan string]string, check bool, db bool) {
	id := time.Now().UnixMilli()
	for subsChan := range chanRange {
		// check if the document is within subscription bound
		if check {
			bound := chanRange[subsChan]
			low := bound[1:strings.Index(bound, ",")]
			fmt.Println(low)
			up := bound[strings.Index(bound, ",")+1 : len(bound)-1]
			fmt.Println(up)
			pathTrimmed := strings.Trim(path, "/")
			paths := strings.Split(pathTrimmed, "/")
			fileName := paths[len(paths)-1]
			fmt.Println(paths)
			fmt.Println(fileName)
			if (low == "" || strings.Compare(fileName, low) >= 0) && (up == "" || strings.Compare(fileName, up) <= 0) {
				subsChan <- fmt.Sprintf("event: %s\ndata: %s\nid: %d\n\n", event, string(data), id)
			}
		} else if db {
			// divide db to several docs
			var dat []document.DocumentContent

			err := json.Unmarshal([]byte(data), &dat)
			if err != nil {
				slog.Error("error:", err)
			}

			for _, d := range dat {
				content, err := json.Marshal(d)
				if err != nil {
					slog.Error("error:", err)
				}
				subsChan <- fmt.Sprintf("event: %s\ndata: %s\nid: %d\n\n", event, string(content), id)
			}
		} else {
			// send content directly
			subsChan <- fmt.Sprintf("event: %s\ndata: %s\nid: %d\n\n", event, string(data), id)
		}
	}
}
