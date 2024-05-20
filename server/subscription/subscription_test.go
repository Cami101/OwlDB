// Test cases for subscription.
package subscription

import (
	"context"
	"io"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// TestNew checks if a new subscriber instance is created.
func TestNew(t *testing.T) {
	subscribers := New()
	_, exists := subscribers.content.Find("nonexistent-key")

	if exists {
		t.Fatal("Expected empty skiplist but found an entry")
	}
}

// TestServeAndNotify verifies if a subscriber can receive notifications after subscribing.
func TestServeAndNotify(t *testing.T) {
	subscribers := New()
	req := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w := httptest.NewRecorder()
	wg := &sync.WaitGroup{}
	wg.Add(1)

	go subscribers.Serve(w, req, wg, "[,]")
	wg.Wait()

	testData := []byte(`{"key":"value"}`)
	subscribers.Notify(req.URL.Path+"testData", "test-event", testData)

	time.Sleep(1 * time.Second)

	response := w.Result()
	defer response.Body.Close()

	body, _ := io.ReadAll(response.Body)
	if !strings.Contains(string(body), `{"key":"value"}`) {
		t.Fatal("Expected notification data not found in the response")
	}
}

// TestNotifyWithNoSubscriber ensures the system handles notifications when no subscribers are present.
func TestNotifyWithNoSubscriber(t *testing.T) {
	subscribers := New()
	testData := []byte(`{"key":"value"}`)
	subscribers.Notify("/v1/testpath/", "test-event", testData)
}

// TestNotifyDocumentRange checks if notifications are sent for documents within a subscribed range.
func TestNotifyDocumentRange(t *testing.T) {
	subscribers := New()
	req := httptest.NewRequest("PUT", "/v1/testcollection?mode=subscribe", nil)
	w := httptest.NewRecorder()
	wg := &sync.WaitGroup{}
	wg.Add(1)

	go subscribers.Serve(w, req, wg, "[doc1,doc5]")
	wg.Wait()

	testData := []byte(`{"docKey":"doc3"}`)
	subscribers.Notify(req.URL.Path, "test-event", testData)

	time.Sleep(1 * time.Second)

	response := w.Result()
	defer response.Body.Close()

	body, _ := io.ReadAll(response.Body)

	if !strings.Contains(string(body), `{"docKey":"doc3"}`) {
		t.Fatal("Expected notification data for doc3 not found in the response")
	}
}

// TestMultipleSubscribersForSingleDocument ensures all subscribers receive notifications for a shared document.
func TestMultipleSubscribersForSingleDocument(t *testing.T) {
	subscribers := New()

	// create two subscribers
	// one subscribing to doc
	req1 := httptest.NewRequest("PUT", "/v1/testpath/doc1?mode=subscribe", nil)
	w1 := httptest.NewRecorder()
	wg1 := &sync.WaitGroup{}
	wg1.Add(1)

	// one subscribing to db
	req2 := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w2 := httptest.NewRecorder()
	wg2 := &sync.WaitGroup{}
	wg2.Add(1)

	go subscribers.Serve(w1, req1, wg1, "[,]")
	go subscribers.Serve(w2, req2, wg2, "[,]")

	wg1.Wait()
	wg2.Wait()

	// send one notification
	testData := []byte(`{"key":"value"}`)
	go subscribers.Notify("/v1/testpath/doc1", "test-event", testData)

	time.Sleep(1 * time.Second)

	// check if both subscribers received the notification
	body1, _ := io.ReadAll(w1.Result().Body)
	body2, _ := io.ReadAll(w2.Result().Body)

	if !strings.Contains(string(body1), `{"key":"value"}`) || !strings.Contains(string(body2), `{"key":"value"}`) {
		t.Fatal("One or both subscribers did not receive the expected notification")
	}
}

// TestBoundaryRangeTest ensures notifications are received only for documents within the range.
func TestBoundaryRangeTest(t *testing.T) {
	subscribers := New()
	req := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w := httptest.NewRecorder()
	wg := &sync.WaitGroup{}
	wg.Add(1)

	go subscribers.Serve(w, req, wg, "[doc1,doc5]")
	wg.Wait()

	outRangeData := []byte(`{"docKey":"doc6"}`)
	subscribers.Notify("/v1/testpath/doc6", "test-event", outRangeData)
	rangeData := []byte(`{"docKey":"doc4"}`)
	subscribers.Notify("/v1/testpath/doc4", "test-event", rangeData)

	time.Sleep(1 * time.Second)

	response := w.Result()
	body, _ := io.ReadAll(response.Body)

	if strings.Contains(string(body), `{"docKey":"doc6"}`) || !strings.Contains(string(body), `{"docKey":"doc4"}`) {
		t.Fatal("Received notification for a document outside of the subscription range or not received for in range document")
	}
}

// TestOverlappingSubscriptions checks if subscribers with overlapping ranges both receive notifications.
func TestOverlappingSubscriptions(t *testing.T) {
	subscribers := New()

	// two overlapping ranges: [doc1,doc4] and [doc3,doc6]
	req1 := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w1 := httptest.NewRecorder()
	wg1 := &sync.WaitGroup{}
	wg1.Add(1)

	req2 := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w2 := httptest.NewRecorder()
	wg2 := &sync.WaitGroup{}
	wg2.Add(1)

	go subscribers.Serve(w1, req1, wg1, "[doc1,doc4]")
	go subscribers.Serve(w2, req2, wg2, "[doc3,doc6]")

	wg1.Wait()
	wg2.Wait()

	// notify a document in the overlap
	overlapData := []byte(`{"docKey":"doc4"}`)
	go subscribers.Notify("/v1/testpath/doc4", "test-event", overlapData)

	time.Sleep(1 * time.Second)

	// check if both subscribers received the notification
	body1, _ := io.ReadAll(w1.Result().Body)
	body2, _ := io.ReadAll(w2.Result().Body)

	if !strings.Contains(string(body1), `{"docKey":"doc4"}`) || !strings.Contains(string(body2), `{"docKey":"doc4"}`) {
		t.Fatal("One or both subscribers did not receive the expected notification for overlapping ranges")
	}
}

// TestNonOverlappingSubscriptions verifies that notifications are correctly sent to subscribers based on their non-overlapping subscription ranges.
func TestNonOverlappingSubscriptions(t *testing.T) {
	subscribers := New()

	req1 := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w1 := httptest.NewRecorder()
	wg1 := &sync.WaitGroup{}
	wg1.Add(1)

	req2 := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w2 := httptest.NewRecorder()
	wg2 := &sync.WaitGroup{}
	wg2.Add(1)

	go subscribers.Serve(w1, req1, wg1, "[doc1,doc4]")
	go subscribers.Serve(w2, req2, wg2, "[doc3,doc6]")

	wg1.Wait()
	wg2.Wait()

	nonoverlapData := []byte(`{"docKey":"doc5"}`)
	go subscribers.Notify("/v1/testpath/doc5", "test-event", nonoverlapData)

	time.Sleep(1 * time.Second)

	body1, _ := io.ReadAll(w1.Result().Body)
	body2, _ := io.ReadAll(w2.Result().Body)

	if strings.Contains(string(body1), `{"docKey":"doc5"}`) || !strings.Contains(string(body2), `{"docKey":"doc5"}`) {
		t.Fatal("One or both subscribers did not receive the expected notification for overlapping ranges")
	}
}

// TestTicker ensures that subscribers receive periodic "ticker" messages.
func TestTicker(t *testing.T) {
	subscribers := New()
	req := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w := httptest.NewRecorder()
	wg := &sync.WaitGroup{}
	wg.Add(1)

	go subscribers.Serve(w, req, wg, "[,]")
	wg.Wait()

	time.Sleep(16 * time.Second)

	response := w.Result()
	defer response.Body.Close()

	body, _ := io.ReadAll(response.Body)
	if !strings.Contains(string(body), `15 sec`) {
		t.Fatal("Expected ticker comment not found in the response")
	}
}

// TestServeAndNotifyDB checks if the notification structure matches the expected format.
func TestServeAndNotifyDB(t *testing.T) {
	subscribers := New()
	req := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	w := httptest.NewRecorder()
	wg := &sync.WaitGroup{}
	wg.Add(1)

	go subscribers.Serve(w, req, wg, "[,]")
	wg.Wait()

	testData := []byte(`[{"path": "string","doc": {"additionalProp1": "string","additionalProp2": "string","additionalProp3": "string"},"meta": {"createdAt": 0,"createdBy": "string","lastModifiedAt": 0,"lastModifiedBy": "string"}}]`)
	subscribers.Notify(req.URL.Path, "test-event", testData)

	time.Sleep(1 * time.Second)

	response := w.Result()
	defer response.Body.Close()

	body, _ := io.ReadAll(response.Body)
	if !strings.Contains(string(body), `{"path"`) {
		t.Fatal("Expected notification data not found in the response")
	}

	if strings.Contains(string(body), `[`) {
		t.Fatal("Document is returned in a slice")
	}
}

// TestCloseChannel ensures the system correctly closes a subscriber's communication channel upon context cancellation.
func TestCloseChannel(t *testing.T) {
	subscribers := New()
	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest("PUT", "/v1/testpath/?mode=subscribe", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()
	wg := &sync.WaitGroup{}
	wg.Add(1)

	go subscribers.Serve(w, req, wg, "[,]")
	wg.Wait()

	cancel()
	time.Sleep(1 * time.Second)

	response := w.Result()
	defer response.Body.Close()

	body, _ := io.ReadAll(response.Body)

	if !(string(body) == "") {
		t.Fatal("Close channel wrong")
	}
}
