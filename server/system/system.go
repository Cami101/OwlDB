// Package system handles request, tokens, and schema.
package system

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/RICE-COMP318-FALL23/owldb-p1group06/authentication"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/collection"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/document"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/filejson"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/skiplist"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/subscription"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/validation"
)

// System represents the server, you can put databases into a system
type System struct {
	system    skiplist.SkipList[string, filejson.FileJson]
	validator validation.Validator
}

// NewSystem creates a new System instance with the given schema.
func NewSystem(schema string) (System, error) {
	var list skiplist.SkipList[string, filejson.FileJson]
	list.MakeSkipList()
	val, err := validation.NewValidator(schema)
	if err != nil {
		return System{}, errors.New("invalid schema passed with -s")
	}
	return System{system: list, validator: val}, nil
}

// New creates a new http.Handler instance with the specified tokens and schema.
func New(tokens string, schema string) (http.Handler, error) {
	sys, err := NewSystem(schema)
	if err != nil {
		slog.Error(err.Error())
		return nil, err
	}
	// Set the handlers for the appropriate paths
	mux := http.NewServeMux()
	subs := subscription.New()
	auth := authentication.New()
	err = auth.UnexpiredToken(tokens)
	if err != nil {
		slog.Error("Error when adding tokens", "error", err)
	}
	handleMethods := func(w http.ResponseWriter, r *http.Request) {
		sys.handleRequest(w, r, &auth, &subs)
	}
	handleAuthentication := func(w http.ResponseWriter, r *http.Request) {
		sys.handleAuth(w, r, &auth)
	}
	mux.HandleFunc("/v1/", handleMethods)
	mux.HandleFunc("/auth", handleAuthentication)
	return mux, nil
}

// handleAuth handles authentication-related HTTP requests.
// It processes POST and DELETE requests for token management.
func (sys *System) handleAuth(w http.ResponseWriter, r *http.Request, auth *authentication.UserToken) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		message, _ := json.Marshal("Failed to read request body")
		WriteJsonResponse(w, message, http.StatusBadRequest)
		return
	}
	var userName authentication.UserString
	json.Unmarshal(body, &userName)
	user := userName.Username

	switch r.Method {
	case http.MethodOptions, "'OPTIONS'":
		// Calls OPTIONS
		Options(w, r)
		return

	case http.MethodPost, "'POST'":
		tok, err := auth.MapToken(user)
		if err != nil {
			message, _ := json.Marshal("No username in request body")
			WriteJsonResponse(w, message, http.StatusBadRequest)
			return
		}
		tokenBytes, _ := json.Marshal(authentication.Token{Token: tok})
		WriteJsonResponse(w, tokenBytes, http.StatusOK)
		return

	case http.MethodDelete, "'DELETE'":
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			message, _ := json.Marshal("Missing or invalid bearer token")
			WriteJsonResponse(w, message, http.StatusUnauthorized)
			return
		}
		authTokSplit := strings.Split(authHeader, " ")
		authTok := authTokSplit[1]
		status := auth.DeleteToken(authTok)
		if status == http.StatusUnauthorized {
			message, _ := json.Marshal("Missing or invalid bearer token")
			WriteJsonResponse(w, message, http.StatusUnauthorized)
			return
		}
		w.Header().Set("content-type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(status)
	}

}

// handleRequest handles incoming HTTP requests for paths beginning with "/v1/".
// It performs various actions based on the HTTP method, including GET, PUT, DELETE, POST, and PATCH.
// and it supports optional subscription mode for real-time updates.
func (sys *System) handleRequest(w http.ResponseWriter, r *http.Request, auth *authentication.UserToken, subscribers *subscription.Subscribers) {
	var data []byte
	var status int

	if r.Method == http.MethodOptions {
		Options(w, r)
		return
	}

	// Check whether the user is authenticated
	authHeader := r.Header.Get("Authorization")

	if authHeader == "" {
		message, _ := json.Marshal("Missing or invalid bearer token")
		WriteJsonResponse(w, message, http.StatusUnauthorized)
		return
	}
	authTokSplit := strings.Split(authHeader, " ")
	authTok := authTokSplit[1]
	user := auth.CheckToken(authTok)

	if user == "" {
		message, _ := json.Marshal("Missing or invalid bearer token")
		WriteJsonResponse(w, message, http.StatusUnauthorized)
		return
	}

	var postToken string
	event := ""
	var wg1 sync.WaitGroup
	var wg2 sync.WaitGroup
	var low string
	var up string
	query := r.URL.Query()
	mode := query.Get("mode")
	itv := query.Get("interval")
	var bound string
	if itv == "" {
		bound = "[,]"
	} else {
		bound = itv
		hasBound := strings.Index(itv, ",")
		if hasBound != -1 {
			low = itv[1:hasBound]
			up = itv[hasBound+1 : len(itv)-1]
		}
	}

	if mode == "subscribe" {
		wg1.Add(1)
		wg2.Add(1)
		go func() {
			defer wg1.Done()
			subscribers.Serve(w, r, &wg2, bound)
		}()
	}
	//curFile is the second last file in the path, lastFile is the last element in the path,
	//lastFile's type = collection if lastFileType = 1, type = document if lastFileType = 0: size(path's elements) mod2
	curFile, lastFileName, lastFileType, status := sys.handlePath(r.URL.Path)

	//invalid path
	if status != 200 {
		data, _ = json.Marshal("invalid path")
		WriteJsonResponse(w, data, status)
		return
	}

	//if it's a valid path, perform http methods
	switch r.Method {
	case http.MethodGet, "'GET'":
		curFile, status = curFile.Next(lastFileName)
		if status != 200 {
			data, _ = json.Marshal("unable to retrive file: " + lastFileName)
		} else {
			data, status = curFile.Get(r.Context(), up, low)
		}
	case http.MethodPut, "'PUT'":
		event = "update"
		var insertedFile filejson.FileJson
		if lastFileType == 1 {
			col := collection.New(r)
			insertedFile = &col
		} else {
			var doc document.Document
			var err error
			timeStamp := GetTimeStamp(r)
			if timeStamp != "" {
				fmt.Println(timeStamp)
				col, ok := curFile.(*collection.Collection)
				if !ok {
					slog.Error("Error: Put: curFile is not of type *collection.Collection")
					return
				}
				time, err := strconv.ParseInt(timeStamp, 10, 64)
				fmt.Println(time)
				if err != nil {
					slog.Error("timestamp must be a number")
				}
				data, status, createdBy, createdAt := col.VerifyTime(lastFileName, time)
				if status != 200 {
					WriteJsonResponse(w, data, status)
					return
				}
				doc, err = document.ReplaceNew(user, r, createdBy, createdAt)
				if err != nil {
					slog.Error(err.Error())
				}
			} else {
				doc, err = document.New(user, r)
			}
			if err != nil {
				slog.Error(err.Error())
				return
			}
			insertedFile = &doc
		}
		data, status = curFile.Put(lastFileName, insertedFile, sys.validator)
		if status == http.StatusBadRequest || status == http.StatusInternalServerError {
			WriteJsonResponse(w, data, status)
			return
		}

	case http.MethodDelete, "'DELETE'":
		event = "delete"
		data, status = curFile.Delete(lastFileName)

	case http.MethodPost, "'POST'":
		event = "update"
		curFile1, success := curFile.Next(lastFileName)
		if success != 200 {
			data, _ = json.Marshal("unable to retrive collection: " + lastFileName)

		} else {
			col, ok := curFile1.(*collection.Collection)
			if !ok {
				slog.Error("Error: Post: curFile is not of type *collection.Collection")
				return
			}
			data, status, postToken = col.Post(user, r)

		}
	case http.MethodPatch, "'PATCH'":
		event = "update"
		nextfile, succ := curFile.Next(lastFileName)
		var insertedFile filejson.FileJson
		if succ != 200 || lastFileType == 1 {
			fmt.Println(succ)
			data, _ = json.Marshal("unable to retrive document: " + lastFileName)

		} else {
			doc := nextfile.(*document.Document)
			createdBy := doc.GetCreatedBy()
			createdAt := doc.GetCreatedAt()
			doc, data, status = doc.Patch(user, r, createdAt, createdBy, sys.validator)
			if status != 200 {
				WriteJsonResponse(w, data, status)
				return
			}
			insertedFile = doc
			curFile.Put(lastFileName, insertedFile, sys.validator)
		}
	default:
		data, _ = json.Marshal("Method not found or unsupported") // Check with swagger
		status = http.StatusMethodNotAllowed
	}
	if mode == "subscribe" {
		wg2.Wait()
		subscribers.Notify(r.URL.Path, "update", data)
	} else {
		WriteJsonResponse(w, data, status)

		if event != "" {
			if event == "delete" {
				notiPath := r.URL.Path
				determinPath := strings.Trim(notiPath, "/")
				determinPaths := strings.Split(determinPath, "/")
				if len(determinPaths) == 2 {
					// the delete url of db has no suffix /, add it
					notiPath = notiPath + "/"
				}

				index1 := strings.Index(notiPath, "/v1/")
				pathDel := notiPath[index1+4:]
				index2 := strings.Index(pathDel, "/")
				var pathDel2 string
				pathDel2 = pathDel[index2:]
				dataDel, err := json.Marshal(pathDel2)
				if err != nil {
					slog.Error("Error in Marshal notify path")
				}

				subscribers.Notify(notiPath, event, dataDel)
			} else {
				if r.Method == http.MethodPost {
					curFile, _ = curFile.Next(lastFileName)
					curFile, _ = curFile.Next(postToken)
					data, status = curFile.Get(r.Context(), "", "")
					subscribers.Notify(r.URL.Path+postToken, event, data)
				} else {
					curFile, _ = curFile.Next(lastFileName)
					data, status = curFile.Get(r.Context(), "", "")
					subscribers.Notify(r.URL.Path, event, data)
				}
			}
		}
	}
	wg1.Wait()

}

// Options handles HTTP OPTIONS requests.
// It sets the appropriate headers for CORS and responds with a 200 OK status.
func Options(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Allow", "GET,POST,PUT,DELETE,OPTIONS,PATCH")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
	w.WriteHeader(http.StatusOK)
}

// Put adds a new Database into the system.
// Checks if the database already exists and returns an error if it does.
// Returns a JSON response with the created database URI or an error message.
func (s *System) Put(dbName string, db filejson.FileJson, validator validation.Validator) ([]byte, int) {

	_, exist := s.system.Find(dbName)

	// if a database exist in dbs
	if exist {
		// Error: Bad Request
		errMsg, _ := json.Marshal("unable to create database " + dbName + ": exists")
		return errMsg, http.StatusBadRequest
	} else {
		check := func(key string, currVal filejson.FileJson, exists bool) (newValue filejson.FileJson, err error) {
			if !exists {
				return db, nil
			}
			return nil, errors.New("cannot update existing database")
		}
		success, err := s.system.Upsert(dbName, check)
		if err != nil {
			slog.Error("Error in System Put")
		}
		if !success {
			slog.Error("System Put failed")
			errMsg, _ := json.Marshal("Inserting into system failed")
			return errMsg, http.StatusInternalServerError
		}
		// create a new database
		uri := "/v1/" + dbName
		uriMap := make(map[string]string)
		uriMap["uri"] = uri
		jsonUri, err := json.Marshal(uriMap)
		if err != nil {
			slog.Error("Error in System Put")
		}
		return jsonUri, http.StatusCreated
	}

}

// Get serves as a part of the filejson.FileJson interface, but in the context of the System,
// It should not be called anytime.
func (c *System) Get(ctx context.Context, high string, low string) ([]byte, int) {
	return nil, 200
}

// Delete removes a database from the system.
// Returns a JSON response indicating the success or failure of the deletion operation.
func (s *System) Delete(dbName string) ([]byte, int) {
	var status int
	var data []byte
	_, exist := s.system.Find(dbName)

	if !exist {
		// Error: db not found
		data, _ = json.Marshal("unable to delete database " + dbName + ": does not exist")
		status = http.StatusNotFound
	} else {
		_, success := s.system.Delete(dbName)
		if !success {
			data, _ = json.Marshal("Database could not be Deleted")
			status = http.StatusInternalServerError
		} else {
			data, _ = json.Marshal("Database Successfully Deleted")
			status = http.StatusNoContent
		}
	}
	/*
	 * Include logic to set data to whatever is written as a response to a delete
	 */
	return data, status
}

// handlePath processes the URL path and retrieves the corresponding file and related information.
// It parses the path, identifies the last file name and type, and returns the second last file,
// the last file name, the last file type (collection or document), and an HTTP status code.
func (s *System) handlePath(url string) (filejson.FileJson, string, int, int) {
	var curFile filejson.FileJson
	var lastFileName string
	var lastFileType int
	var status int

	// Clean up the path to make it usable
	index := strings.Index(url, "/v1/")
	path := url[index+4:]
	path_trimmed := strings.Trim(path, "/")
	paths := strings.Split(path_trimmed, "/")

	lastFileType = len(paths) % 2
	lastFileName = paths[len(paths)-1]

	status = http.StatusOK

	curFile = s
	for _, file := range paths[:len(paths)-1] {
		curFile, status = curFile.Next(file)
		if status != 200 {
			status = http.StatusBadRequest
			break
		}
	}
	return curFile, lastFileName, lastFileType, status
}

// Next retrieves the next nested filejson.FileJson from the System and returns it and a status.
func (s *System) Next(next string) (filejson.FileJson, int) {
	db, exist := s.system.Find(next)
	if !exist {
		return nil, http.StatusNotFound
	}
	return db.GetVal(), http.StatusOK
}

// WriteJsonResponse writes a JSON response to the http.ResponseWriter.
// Sets the appropriate headers and writes the provided data with the specified HTTP status code.
func WriteJsonResponse(w http.ResponseWriter, data []byte, status int) {
	w.Header().Set("content-type", "application/json")
	w.Header().Set("content-length", strconv.Itoa(len(data)))
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(status)
	w.Write(data)
}

// GetTimeStamp retrieves the timestamp from the HTTP request query parameters.
// Returns the timestamp as a string.
func GetTimeStamp(r *http.Request) string {
	return r.URL.Query().Get("timestamp")
}

// GetLastModifiedAt returns the last modified timestamp.
// This function is part of the filejson.FileJson interface.
// In the context of System, it always returns 0 as it does not have a meaningful last modified timestamp.
func (s *System) GetLastModifiedAt() int64 {
	return 0
}
