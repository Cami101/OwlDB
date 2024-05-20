// A package designed to deal with validation against a JSON schema
package validation

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/santhosh-tekuri/jsonschema/v5"
)

// Validator represents a JSON schema validator.
type Validator struct {
	schema *jsonschema.Schema
}

// NewValidator creates a new Validator instance based on the provided JSON schema.
// It compiles the JSON schema and returns a Validator instance.
// Returns an error if the provided schema is invalid.
func NewValidator(schema string) (Validator, error) {
	compiler := jsonschema.NewCompiler()

	// Create new schema
	jsonschema, err := compiler.Compile(schema)
	if err != nil {
		slog.Error("Error in JSON schema passed")
		return Validator{}, errors.New("invalid schema passed with -s")
	}
	return Validator{schema: jsonschema}, nil
}

// ValidateSchema validates the provided JSON data against the schema.
// Returns true if the data conforms to the schema, false otherwise.
func (v Validator) ValidateSchema(jsondata []byte) bool {

	var d interface{}
	if err := json.Unmarshal(jsondata, &d); err != nil {
		slog.Error("unable to unmarshal data", "data", jsondata, "error", err)
		return false
	}
	if err := v.schema.Validate(d); err != nil {
		msg := fmt.Sprintf("%#v", err)
		slog.Error("data does not conform to the schema", "error", msg)
		return false
	}
	return true
}
