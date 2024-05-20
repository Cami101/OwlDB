// Test cases for objvisitor.
package objvisitor

import (
	"testing"
)

// Test for the New function
func TestNew(t *testing.T) {
	path := []string{"a", "b", "c"}
	data := "data"
	op := "operation"

	visitor := New(path, data, op)

	if !equalStringSlices(path, visitor.path) {
		t.Errorf("Expected path %v, got %v", path, visitor.path)
	}
	if data != visitor.data {
		t.Errorf("Expected data %s, got %s", data, visitor.data)
	}
	if op != visitor.op {
		t.Errorf("Expected op %s, got %s", op, visitor.op)
	}
}

// Test for the Map method where the map doesn't have the key from the path
func TestMap_NoKeyInPath(t *testing.T) {
	path := []string{"nonExistentKey"}
	data := "data"
	op := "operation"
	m := make(map[string]any)

	visitor := New(path, data, op)
	_, err := visitor.Map(m)

	if err == nil {
		t.Error("Expected an error but got nil")
	} else if err.Error() != "error applying patches: map has no key in the middle of the path" {
		t.Errorf("Expected error message %s, got %s", "error applying patches: map has no key in the middle of the path", err.Error())
	}
}

// Test for the Map method with operation "ObjectAdd" and path length 0
func TestMap_ObjectAdd_PathLengthZero(t *testing.T) {
	path := []string{}
	data := "newValue"
	op := "ObjectAdd"
	m := make(map[string]any)

	visitor := New(path, data, op)
	updatedMap, _ := visitor.Map(m)
	updatedMap1, ok := updatedMap.(map[string]any)
	if !ok {
		t.Error("Expected a map[string]any type")
	}

	if updatedMap1[""] != data {
		t.Errorf("Expected map value %s, got %s", data, updatedMap1[""])
	}
}

// Test for the Map method with operation "ObjectAdd" and path length 1
func TestMap_ObjectAdd_PathLengthOne(t *testing.T) {
	path := []string{"key1"}
	data := "newValue"
	op := "ObjectAdd"
	m := make(map[string]any)

	visitor := New(path, data, op)
	updatedMap, _ := visitor.Map(m)
	updatedMap1, ok := updatedMap.(map[string]any)
	if !ok {
		t.Error("Expected a map[string]any type")
	}

	if updatedMap1["key1"] != data {
		t.Errorf("Expected map value %s for key 'key1', got %s", data, updatedMap1["key1"])
	}
}

// Test for the Slice method with path length 0 and operation "ObjectAdd"
func TestSlice_PathLengthZero_ObjectAdd(t *testing.T) {
	path := []string{}
	data := "newValue"
	op := "ObjectAdd"
	s := []any{}

	visitor := New(path, data, op)
	_, err := visitor.Slice(s)

	if err == nil || err.Error() != "cannot perform ObjectAdd in Slice" {
		t.Error("Expected error for ObjectAdd operation in Slice")
	}
}

// Test for the Slice method with path length 0 and operation "ArrayRemove"
func TestSlice_PathLengthZero_ArrayRemove(t *testing.T) {
	path := []string{}
	data := "value"
	op := "ArrayRemove"
	s := []any{"value", "otherValue"}

	visitor := New(path, data, op)
	updatedSlice, _ := visitor.Slice(s)

	if len(updatedSlice.([]any)) != 1 || updatedSlice.([]any)[0] != "otherValue" {
		t.Error("Expected slice to have removed the value")
	}
}

// Test for the Bool, Float64, String, and Null methods with non-empty path
func TestTypes_NonEmptyPath(t *testing.T) {
	path := []string{"key"}

	visitor := New(path, true, "operation")
	_, err := visitor.Bool(true)
	if err == nil || err.Error() != "invalid patch, unfinished" {
		t.Error("Expected error for unfinished patch with Bool")
	}

	visitor = New(path, 1.23, "operation")
	_, err = visitor.Float64(1.23)
	if err == nil || err.Error() != "invalid patch, unfinished" {
		t.Error("Expected error for unfinished patch with Float64")
	}

	visitor = New(path, "stringValue", "operation")
	_, err = visitor.String("stringValue")
	if err == nil || err.Error() != "invalid patch, unfinished" {
		t.Error("Expected error for unfinished patch with String")
	}

	visitor = New(path, nil, "operation")
	_, err = visitor.Null()
	if err == nil || err.Error() != "invalid patch, unfinished" {
		t.Error("Expected error for unfinished patch with Null")
	}
}

// Test for the Map method where path has length greater than 0 and a key matches
func TestMap_PathGreaterThanZero_KeyMatch(t *testing.T) {
	path := []string{"key1", "key2"}
	data := "data"
	op := "operation"
	m := map[string]any{
		"key1": map[string]any{
			"key2": "originalValue",
		},
		"key3": "otherValue",
	}

	visitor := New(path, data, op)
	result, err := visitor.Map(m)

	if err != nil {
		t.Error("Unexpected error:", err)
		return
	}

	updatedMap, ok := result.(map[string]any)
	if !ok {
		t.Error("Expected result to be of type map[string]any")
		return
	}

	nestedMap, ok := updatedMap["key1"].(map[string]any)
	if !ok {
		t.Error("Expected nested map to be of type map[string]any")
		return
	}

	if nestedMap["key2"] != "originalValue" {
		t.Errorf("Expected nested map value %s, got %v", "originalValue", nestedMap["key2"])
	}

	if updatedMap["key3"] != "otherValue" {
		t.Error("Expected unchanged value for key 'key3'")
	}
}

// Helper function to check equality of string slices
func equalStringSlices(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i, v := range a {
		if v != b[i] {
			return false
		}
	}
	return true
}
