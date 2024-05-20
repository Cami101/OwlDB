// Test cases for collection.
package collection

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Tests the creation of a new Collection object from an HTTP request.
func TestNewFunction(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/db1/", nil)

	collection := New(req)

	if collection.path != "db1" {
		t.Errorf("Expected path to be 'db1', got %s", collection.path)
	}

}

// Test posting a new document into the collection.
func TestCollectionPost(t *testing.T) {
	body := bytes.NewBufferString(`{"key":"value"}`)
	req := httptest.NewRequest(http.MethodPost, "/v1/testCollection", body)
	req.Header.Set("Content-Type", "application/json")

	col := New(req)

	jsonUri, status, token := col.Post("testUser", req)

	// Check token
	if token == "" {
		t.Error("Token should not be empty")
	}

	// Check status
	if status != http.StatusCreated {
		t.Errorf("Expected status code to be 201 Created, got %d", status)
	}

	// Check URI
	expectedUri := "{\"uri\":\"/v1/testCollection/" + token + "\"}"
	if string(jsonUri) != expectedUri {
		t.Errorf("Expected URI to be %s, got %s", expectedUri, string(jsonUri))
	}

	// Check if the document has been added to the collection
	doc, docStatus := col.Next(token)
	if docStatus != http.StatusOK {
		t.Errorf("Expected status code to be 200 OK, got %d", docStatus)
	}
	if doc == nil {
		t.Error("Document should not be nil")
	}
}

// Remaining functions tested in system_test.go.
