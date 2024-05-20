// Package collection provides functionality for handling the representation of collections and databases.
//
// This package defines a Collection type. It includes methods for creating a new collection, adding documents to the collection, retrieving documents, deleting
// documents, posting new documents, obtaining the next document
package collection

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/RICE-COMP318-FALL23/owldb-p1group06/document"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/filejson"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/skiplist"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/validation"
)

// Collection represents a collection of documents.
type Collection struct {
	path      string
	documents skiplist.SkipList[string, filejson.FileJson]
}

// New creates a new Collection instance based on the provided HTTP request.
func New(r *http.Request) Collection {
	index := strings.Index(r.URL.Path, "/v1/")
	path := r.URL.Path[index+4:]
	path = strings.Trim(path, "/")
	var list skiplist.SkipList[string, filejson.FileJson]
	list.MakeSkipList()
	return Collection{path: path, documents: list}
}

// Put adds a new document to the collection and returns the marshaled document URI and a status.
func (c *Collection) Put(docName string, doc filejson.FileJson, validator validation.Validator) ([]byte, int) {
	_, exist := c.documents.Find(docName)
	var status int
	if exist {
		status = http.StatusOK
	} else {
		status = http.StatusCreated
	}

	document := doc.(*document.Document)

	if !validator.ValidateSchema(document.GetContent().Doc) {
		slog.Error("Invalid JSON data in document put")
		return []byte{}, http.StatusBadRequest
	}

	check := func(key string, currVal filejson.FileJson, exists bool) (newValue filejson.FileJson, err error) {
		return doc, nil
	}
	success, err := c.documents.Upsert(docName, check)
	if err != nil {
		slog.Error("Error in upsert into document")
		return nil, http.StatusBadRequest
	}
	if !success {
		errMsg, _ := json.Marshal("Inserting into collection failed")
		return errMsg, http.StatusInternalServerError
	}

	uri := make(map[string]string)
	uri["uri"] = "/v1/" + c.path + "/" + docName
	jsonUri, err := json.Marshal(uri)
	if err != nil {
		slog.Error("Error in Collection Put")
	}
	return jsonUri, status
}

// Get retrieves all documents in the collection within the specified range and returns them as a JSON byte slice of DocumentContent, and returns a status code.
func (c *Collection) Get(ctx context.Context, high string, low string) ([]byte, int) {
	data := make([]document.DocumentContent, 0)
	var documents []*skiplist.Node[string, filejson.FileJson]
	var success bool
	if high == "" {
		high = c.documents.GetLastNode().GetKey()
	}
	if low == "" {
		low = c.documents.GetHeadNode().GetKey()
	}
	documents, success = c.documents.Query(ctx, low, high)
	if !success {
		errMsg, _ := json.Marshal("Getting all documents in collection failed")
		return errMsg, http.StatusInternalServerError
	}
	for _, fileJsonDoc := range documents {
		// Use type assertion to convert the FileJson interface to Document
		doc, ok := fileJsonDoc.GetVal().(*document.Document)
		if !ok {
			// Handle the case where the assertion fails (doc is not of type *document.Document)
			slog.Error("Error: Document is not of type *document.Document")
			continue
		}
		data = append(data, doc.GetContent())
	}
	docs, err := json.Marshal(data)
	if err != nil {
		slog.Error("Error in Collection marshal")
	}
	return docs, http.StatusOK
}

// Delete removes a document from the collection and returns an marshaled message the status.
func (c *Collection) Delete(docName string) ([]byte, int) {
	var status int
	var data []byte
	_, exist := c.documents.Find(docName)

	if !exist {
		// Error: db not found
		data, _ = json.Marshal("unable to delete docuement " + docName + ": does not exist")
		status = http.StatusNotFound
	} else {
		_, success := c.documents.Delete(docName)
		if !success {
			errMsg, _ := json.Marshal("Deleting document in collection failed")
			return errMsg, http.StatusInternalServerError
		}
		data, _ = json.Marshal("document successfully deleted")
		status = http.StatusNoContent
	}
	/*
	 * Include logic to set data to whatever is written as a response to a delete
	 */
	return data, status
}

// Post creates a new document with a randomly generated token name in the collection and returns the marshaled document URI, status, and token.
func (c *Collection) Post(user string, r *http.Request) ([]byte, int, string) {
	var token string
	var file filejson.FileJson

	for {
		numBytes := 12
		// Generate random bytes
		bytes := make([]byte, numBytes)
		_, err := rand.Read(bytes)
		if err != nil {
			slog.Error(err.Error())
		}
		token = base64.StdEncoding.EncodeToString(bytes)
		token = strings.ReplaceAll(token, "/", "-")
		token = strings.ReplaceAll(token, "\\", "-")
		_, exist := c.documents.Find(token)
		if !exist {
			break
		}
	}
	doc, err := document.New(user, r)
	if err != nil {
		slog.Error(err.Error())
		return []byte{}, 0, ""
	}
	doc.AddTokenToPath(token)
	file = &doc
	check := func(key string, currVal filejson.FileJson, exists bool) (newValue filejson.FileJson, err error) {
		if !exists {
			return file, nil
		}
		return nil, errors.New("duplicated POST key")
	}
	success, err := c.documents.Upsert(token, check)
	if err != nil {
		slog.Error("Error in inserting document into collection in post")
	}
	if !success {
		errMsg, _ := json.Marshal("Post collection failed")
		return errMsg, http.StatusInternalServerError, ""
	}
	uri := make(map[string]string)
	uri["uri"] = "/v1/" + c.path + "/" + token
	jsonUri, err := json.Marshal(uri)
	if err != nil {
		slog.Error("Error in Collection Post")
	}
	return jsonUri, http.StatusCreated, token
}

// Next retrieves the next document in the collection.
// It returns the next nested filejson.FileJson and status code.
func (c *Collection) Next(next string) (filejson.FileJson, int) {
	doc, exist := c.documents.Find(next)
	if !exist {
		return nil, http.StatusBadRequest
	}

	return doc.GetVal(), http.StatusOK
}

// GetLastModifiedAt returns the last modified timestamp for the collection.
func (c *Collection) GetLastModifiedAt() int64 {
	return 0
}

// VerifyTime verifies the timestamp of a document against a provided time.
// It returns the marshaled verification message, status code, creator information, and creation timestamp.
func (c *Collection) VerifyTime(docName string, time int64) ([]byte, int, string, int64) {
	var data string
	var status int
	var createdBy string
	var createdAt int64
	file, exist := c.documents.Find(docName)
	if !exist {
		data = "document not found"
		status = http.StatusNotFound
		msg, _ := json.Marshal(data)
		return msg, status, "", 0
	} else {
		doc := file.GetVal().(*document.Document)
		oldTime := doc.GetLastModifiedAt()
		createdAt = doc.GetCreatedAt()
		createdBy = doc.GetCreatedBy()
		if oldTime != time {
			data = "pre-condition timestamp doesn't match current timestamp"
			status = http.StatusBadRequest
		} else {
			data = "matched!"
			status = http.StatusOK
		}
	}
	msg, _ := json.Marshal(data)
	return msg, status, createdBy, createdAt
}

// SplitPath splits the provided path into individual components.
// It returns the components as a slice of strings.
func SplitPath(path string) ([]string, error) {
	if !strings.HasPrefix(path, "/") {
		return nil, errors.New("path must start with a forward slash")
	}
	path_trimmed := strings.Trim(path, "/")
	paths := strings.Split(path_trimmed, "/")
	return paths, nil
}
