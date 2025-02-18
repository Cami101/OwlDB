// Package document provides functionality for dealing with the representation of documents.
//
// This package defines a Document type, which represents a document with contents and metadata.
// It includes methods for creating new documents, replacing existing documents, retrieving document
// content.
package document

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/RICE-COMP318-FALL23/owldb-p1group06/filejson"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/jsonvisit"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/objvisitor"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/skiplist"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/validation"
)

// Document represents a document with contents and metadata.
type Document struct {
	contents    DocumentContent
	collections skiplist.SkipList[string, filejson.FileJson]
}

// DocumentContent represents the path, the contents and metadata of a document.
type DocumentContent struct {
	Path     string          `json:"path"`
	Doc      json.RawMessage `json:"doc"`
	Metadata Metadata        `json:"meta"`
}

// Metadata represents metadata information for a document.
type Metadata struct {
	CreatedBy      string `json:"createdBy"`
	CreatedAt      int64  `json:"createdAt"`
	LastModifiedBy string `json:"lastModifiedBy"`
	LastModifiedAt int64  `json:"lastModifiedAt"`
}

// PatchResult represents the result of applying a patch to a document.
type PatchResult struct {
	Uri         string `json:"uri"`
	PatchFailed bool   `json:"patchFailed"`
	Message     string `json:"message"`
}

// New creates a new Document instance with the specified user and HTTP request.
// It parses the request body and sets the document content and metadata.
func New(user string, r *http.Request) (Document, error) {
	var content DocumentContent
	var list skiplist.SkipList[string, filejson.FileJson]
	meta := Metadata{CreatedAt: time.Now().UnixMilli(),
		CreatedBy:      user,
		LastModifiedAt: time.Now().UnixMilli(),
		LastModifiedBy: user}
	index := strings.Index(r.URL.Path, "/v1/")
	path := r.URL.Path[index+4:]
	doc, err := io.ReadAll(r.Body)
	defer r.Body.Close()
	if err != nil {
		slog.Error("Couldn't read request body")
		return Document{}, errors.New("couldn't read request body")
	}
	content = DocumentContent{Path: path, Doc: doc, Metadata: meta}
	list.MakeSkipList()
	return Document{contents: content, collections: list}, nil
}

// ReplaceNew updates and substitue the old doc, but keeps its original created time and user, return the updated document and a error (used for patch)
func ReplaceNew(user string, r *http.Request, createdBy string, createdAt int64) (Document, error) {
	var content DocumentContent
	var list skiplist.SkipList[string, filejson.FileJson]
	meta := Metadata{CreatedAt: createdAt,
		CreatedBy:      createdBy,
		LastModifiedAt: time.Now().UnixMilli(),
		LastModifiedBy: user}
	index := strings.Index(r.URL.Path, "/v1/")
	path := r.URL.Path[index+4:]
	doc, err := io.ReadAll(r.Body)
	defer r.Body.Close()
	if err != nil {
		slog.Error("Couldn't read request body")
		return Document{}, errors.New("couldn't read request body")
	}
	content = DocumentContent{Path: path, Doc: doc, Metadata: meta}
	list.MakeSkipList()
	return Document{contents: content, collections: list}, nil
}

// GetContent returns the DocumentContent field in Document.
func (d *Document) GetContent() DocumentContent {
	index := strings.Index(d.contents.Path, "/")
	path := d.contents.Path[index:]
	content := DocumentContent{
		Path:     path,
		Doc:      d.contents.Doc,
		Metadata: d.contents.Metadata}
	return content
}

// Get retrieves the document content and returns marshaledContent of the doc content and a status code
func (d *Document) Get(ctx context.Context, high string, low string) ([]byte, int) {
	docContent := d.GetContent()
	marshaledContent, err := json.Marshal(docContent)
	if err != nil {
		slog.Error("Error in marhsal doc content")
	}
	return marshaledContent, http.StatusOK
}

// Put puts a collection into the document and returns a marshal response body (uri or message) and a status code
func (d *Document) Put(colName string, col filejson.FileJson, validator validation.Validator) ([]byte, int) {

	_, exist := d.collections.Find(colName)

	if exist {
		// Error: Bad Request
		jsonUri, _ := json.Marshal("unable to create collection " + colName + ": exists")
		return jsonUri, http.StatusBadRequest
	} else {
		check := func(key string, currVal filejson.FileJson, exists bool) (newValue filejson.FileJson, err error) {
			if !exists {
				return col, nil
			}
			return nil, errors.New("cannot update existing database")
		}
		success, err := d.collections.Upsert(colName, check)
		if err != nil {
			slog.Error("Error in Upsert collection into document")
		}
		if !success {
			errMsg, _ := json.Marshal("Inserting into document failed")
			return errMsg, http.StatusInternalServerError
		}
		uri := make(map[string]string)
		uri["uri"] = "/v1/" + d.contents.Path + "/" + colName + "/"
		jsonUri, _ := json.Marshal(uri)
		return jsonUri, http.StatusCreated
	}
}

// Delete removes a collection from the document and returns marshaled response body and the status
func (d *Document) Delete(colName string) ([]byte, int) {
	var status int
	var data []byte
	_, exist := d.collections.Find(colName)

	if !exist {
		// Error: db not found
		data, _ = json.Marshal("unable to delete collection " + colName + ": does not exist")
		status = http.StatusNotFound
	} else {
		_, success := d.collections.Delete(colName)
		if !success {
			slog.Error("Error in Document deletion")
			errMsg, _ := json.Marshal("Deleting collection from document failed")
			return errMsg, http.StatusInternalServerError
		}
		data, _ = json.Marshal("collection successfully deleted")
		status = http.StatusNoContent
	}
	/*
	 * Include logic to set data to whatever is written as a response to a delete
	 */
	return data, status
}

// Next retrieves the next nested filejson.FileJson from the document and returns it and a status.
func (d *Document) Next(next string) (filejson.FileJson, int) {
	col, exist := d.collections.Find(next)
	if !exist {
		return nil, http.StatusNotFound
	}
	return col.GetVal(), http.StatusOK
}

// AddTokenToPath appends a token to the document path.
func (d *Document) AddTokenToPath(token string) {
	d.contents.Path = d.contents.Path + token
}

// GetLastModifiedAt returns the last modified timestamp of the document.
func (d *Document) GetLastModifiedAt() int64 {
	return d.contents.Metadata.LastModifiedAt
}

// GetCreatedAt returns the created timestamp of the document.
func (d *Document) GetCreatedAt() int64 {
	return d.contents.Metadata.CreatedAt
}

// GetCreatedBy returns the creator of the document.
func (d *Document) GetCreatedBy() string {
	return d.contents.Metadata.CreatedBy
}

// Patch applies a JSON patch to the document and returns the updated document, marshaled response body, and status.
func (d *Document) Patch(user string, r *http.Request, createdAt int64, createdBy string, validator validation.Validator) (*Document, []byte, int) {
	//read the array of jsonObjects
	data, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("Couldn't read request body")
	}
	defer r.Body.Close()

	//unmarshal the input json object to three fields: op, path, and value.
	var l []map[string]any
	var op string
	var path []string
	var value any

	err = json.Unmarshal(data, &l)
	//cannot unmarshal data
	if err != nil {
		data, _ := json.Marshal(err)
		return nil, data, http.StatusBadRequest
	}

	var newDoc = d
	//finish each request
	patchFailed := false
	msg := "patch applied"
	for _, v := range l {

		op = v["op"].(string)
		fmt.Println(op)
		//op must be one of the following three operations
		if op != "ArrayAdd" && op != "ArrayRemove" && op != "ObjectAdd" {
			msg = "op must be ArrayAdd or ArrayRemove or ObjectAdd"
			patchFailed = true
			break
		}
		path, err = SplitPath(v["path"].(string))
		fmt.Println(path)
		if err != nil {
			patchFailed = true
			break
		}
		value = v["value"]

		visitor := objvisitor.New(path, value, op)
		fmt.Println(path)

		var c map[string]any
		err = json.Unmarshal(newDoc.contents.Doc, &c)
		if err != nil {
			msg = "Error in unmarshaling doc content"
			patchFailed = true
			break
		}
		result, err := jsonvisit.Accept(c, visitor)
		// Check result against json schema
		if err != nil {
			msg = "Error in accepting c"
			patchFailed = true
			break
		}
		docContent, err := json.Marshal(result)
		if !validator.ValidateSchema(docContent) {
			slog.Error("Invalid JSON data in document patch")
			return nil, nil, http.StatusBadRequest
		}
		if err != nil {
			msg = "Error in marhsaling request back"
			patchFailed = true
			break
		}
		newDoc = &Document{collections: newDoc.collections,
			contents: DocumentContent{Path: newDoc.contents.Path,
				Doc: docContent,
				Metadata: Metadata{CreatedAt: newDoc.contents.Metadata.CreatedAt,
					CreatedBy:      newDoc.contents.Metadata.CreatedBy,
					LastModifiedAt: time.Now().UnixMilli(),
					LastModifiedBy: user,
				}}}
	}

	responese := PatchResult{
		Uri:         "/v1/" + d.contents.Path,
		PatchFailed: patchFailed,
		Message:     msg}
	jsonresponse, _ := json.Marshal(responese)
	return newDoc, jsonresponse, http.StatusOK
}

// SplitPath splits a path string and returns the individual path components.
func SplitPath(path string) ([]string, error) {
	if !strings.HasPrefix(path, "/") {
		return nil, errors.New("path must start with a forward slash")
	}
	path_trimmed := strings.Trim(path, "/")
	paths := strings.Split(path_trimmed, "/")
	return paths, nil
}
