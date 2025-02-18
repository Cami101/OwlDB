// A package containing an interface for database,
// document, and collection operations
package filejson

import (
	"context"

	"github.com/RICE-COMP318-FALL23/owldb-p1group06/validation"
)

// interface FileJson
type FileJson interface {
	//Put a Filejson inside a Filejson, such as putting a document in a collection, or putting a collection in a document
	//then return jsonmarshaled uri map if successful or jsonmarshaled error message if unsuccessful, and a status code
	Put(string, FileJson, validation.Validator) ([]byte, int)

	// Get the current Filejson, return jsonmarshaled document content or jsonmarshaled a list of document contents, and a status code
	Get(ctx context.Context, high string, low string) ([]byte, int)

	// Delete the file within the FileJson at the path of the parameter passed
	Delete(string) ([]byte, int)

	// Search for a Filejson b inside a Filejson a. Return b if b is found, or nil if b is not found, and a status code
	Next(next string) (FileJson, int)
}
