// Test cases for validation.
package validation

import (
	"encoding/json"
	"testing"
)

// initSchemas initializes a slice of strings representing paths to JSON schema files.
// These paths will be used for validation in the tests.
func initSchemas() []string {
	schema1 := "./testschemas/testschema1.json"
	schema2 := "./testschemas/testschema2.json"
	schema3 := "testschemas/testschema3.json"
	schemas := make([]string, 3)
	schemas[0] = schema1
	schemas[1] = schema2
	schemas[2] = schema3
	return schemas
}

// TestValidSchemas tests the validation of two different JSON schemas against various JSON instances.
// It uses NewValidator to create a validator for each schema and then tests them
// against different valid and invalid JSON instances.
func TestValidSchemas(t *testing.T) {
	schemas := initSchemas()
	val1, err := NewValidator(schemas[0])
	if err != nil {
		t.Error("Schema1 is invalid")
	}
	val2, err := NewValidator(schemas[1])
	if err != nil {
		t.Error("Schema2 is invalid")
	}
	validdict1 := map[string]int{"string": 5, "word": 7}
	validjson1, _ := json.Marshal(validdict1)
	validdict2 := map[string]any{"name": "myName", "age": 21}
	validjson2, _ := json.Marshal(validdict2)
	emptydict1 := map[string]any{}
	emptyjson1, _ := json.Marshal(emptydict1)
	invalidjson := "invalidjson"

	if val1.ValidateSchema(validjson1) == false {
		t.Error("val1 declared validjson1 invalid, should be valid")
	}
	if val1.ValidateSchema(validjson2) == false {
		t.Error("val1 declared validjson2 invalid, should be valid")
	}
	if val1.ValidateSchema(emptyjson1) == false {
		t.Error("val1 declared emptyjson invalid, should be valid")
	}
	if val1.ValidateSchema([]byte(invalidjson)) == true {
		t.Error("val1 declared invalidjson valid, should be invalid")
	}
	if val2.ValidateSchema(validjson1) == true {
		t.Error("val2 declared validjson1 valid, should be invalid")
	}
	if val2.ValidateSchema(validjson2) == false {
		t.Error("val2 declared validjson2 invalid, should be valid")
	}
	if val2.ValidateSchema(emptyjson1) == true {
		t.Error("val2 declared emptyjson valid, should be invalid")
	}
	if val2.ValidateSchema([]byte(invalidjson)) == true {
		t.Error("val2 declared invalidjson valid, should be invalid")
	}

}

// TestInvalidSchema tests the validation of a schema that is expected to be invalid.
// It ensures that NewValidator returns an error for the invalid schema.
func TestInvalidSchema(t *testing.T) {
	schemas := initSchemas()
	schema := schemas[2]
	_, err := NewValidator(schema)
	if err == nil {
		t.Error("Invalid schema was validated!")
	}
}
