// Test cases for document.
package document

import (
	"bytes"
	"context"
	"net/http"
	"reflect"
	"testing"
)

// Tests the creation of a new Document object from an HTTP request.
func TestNew(t *testing.T) {
	body := bytes.NewBuffer([]byte(`{"key": "value"}`))
	req, err := http.NewRequest("GET", "/v1/testpath", body)
	if err != nil {
		t.Fatalf("Could not create mock request: %v", err)
	}

	user := "testUser"
	doc, err := New(user, req)
	if err != nil {
		t.Fatalf("Expected no error, but got: %v", err)
	}

	if doc.contents.Path != "testpath" {
		t.Errorf("Expected path 'testpath', but got: %v", doc.contents.Path)
	}

	if doc.contents.Metadata.CreatedBy != user {
		t.Errorf("Expected user '%v', but got: %v", user, doc.contents.Metadata.CreatedBy)
	}
}

// Tests the retrieval of content from a Document object.
func TestGetContent(t *testing.T) {
	doc := Document{
		contents: DocumentContent{
			Path: "/test",
			Doc:  []byte(`{"key": "value"}`),
		},
	}

	content := doc.GetContent()
	if content.Path != "/test" {
		t.Errorf("Expected path '/test', but got: %v", content.Path)
	}
}

// Tests the creation of a new Document object by replacing the content of an existing one.
func TestReplaceNew(t *testing.T) {
	body := bytes.NewBuffer([]byte(`{"key": "newValue"}`))
	req, err := http.NewRequest("GET", "/v1/testpath", body)
	if err != nil {
		t.Fatalf("Could not create mock request: %v", err)
	}

	user := "newUser"
	createdBy := "originalUser"
	createdAt := int64(12345678)
	doc, err := ReplaceNew(user, req, createdBy, createdAt)
	if err != nil {
		t.Fatalf("Expected no error, but got: %v", err)
	}

	if doc.contents.Metadata.LastModifiedBy != user {
		t.Errorf("Expected last modified by '%v', but got: %v", user, doc.contents.Metadata.LastModifiedBy)
	}

	if doc.contents.Metadata.CreatedBy != createdBy {
		t.Errorf("Expected created by '%v', but got: %v", createdBy, doc.contents.Metadata.CreatedBy)
	}
}

// Tests the addition of a token to a Document's path (for POST).
func TestAddTokenToPath(t *testing.T) {
	token := "sampleToken"
	doc := Document{
		contents: DocumentContent{
			Path: "/initialPath",
		},
	}

	doc.AddTokenToPath(token)
	expectedPath := "/initialPath" + token
	if doc.contents.Path != expectedPath {
		t.Errorf("Expected path '%v', but got: %v", expectedPath, doc.contents.Path)
	}
}

// Tests the retrieval of a Document's content given specific conditions.
func TestGet(t *testing.T) {
	doc := Document{
		contents: DocumentContent{
			Path: "/test",
			Doc:  []byte(`{"key": "value"}`),
		},
	}

	marshaledContent, status := doc.Get(context.Background(), "", "")

	if status != http.StatusOK {
		t.Errorf("Expected status %v, but got: %v", http.StatusOK, status)
	}

	if !bytes.Contains(marshaledContent, []byte("key")) {
		t.Errorf("Expected content to contain 'key', but got: %v", string(marshaledContent))
	}
}

// Tests the retrieval of the timestamp when a Document was last modified.
func TestGetLastModifiedAt(t *testing.T) {
	timestamp := int64(12345678)
	doc := Document{
		contents: DocumentContent{
			Metadata: Metadata{
				LastModifiedAt: timestamp,
			},
		},
	}

	if doc.GetLastModifiedAt() != timestamp {
		t.Errorf("Expected timestamp %v, but got: %v", timestamp, doc.GetLastModifiedAt())
	}
}

// Tests the retrieval of the timestamp when a Document was created.
func TestGetCreatedAt(t *testing.T) {
	timestamp := int64(12345678)
	doc := Document{
		contents: DocumentContent{
			Metadata: Metadata{
				CreatedAt: timestamp,
			},
		},
	}

	if doc.GetCreatedAt() != timestamp {
		t.Errorf("Expected timestamp %v, but got: %v", timestamp, doc.GetCreatedAt())
	}
}

// Tests the retrieval of the user who created a Document.
func TestGetCreatedBy(t *testing.T) {
	user := "testUser"
	doc := Document{
		contents: DocumentContent{
			Metadata: Metadata{
				CreatedBy: user,
			},
		},
	}

	if doc.GetCreatedBy() != user {
		t.Errorf("Expected user %v, but got: %v", user, doc.GetCreatedBy())
	}
}

// Tests the splitting of a path into its constituent segments.
func TestSplitPath(t *testing.T) {
	// Test a valid path
	path := "/a/b/c"
	segments, err := SplitPath(path)
	if err != nil {
		t.Fatalf("Expected no error, but got: %v", err)
	}

	expectedSegments := []string{"a", "b", "c"}
	if !reflect.DeepEqual(segments, expectedSegments) {
		t.Errorf("Expected segments %v, but got: %v", expectedSegments, segments)
	}

	badPath := "/a/b/c/"
	_, err = SplitPath(badPath)
	if err != nil {
		t.Fatalf("Expected no error, but got: %v", err)
	}

	// Test empty path
	emptyPath := ""
	_, err = SplitPath(emptyPath)
	if err == nil {
		t.Error("Expected an error due to empty path, but got none")
	}
}

// Remaining functions tested in system_test.go.
