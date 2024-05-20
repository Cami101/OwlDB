// This package serves to access and modify the jsonObject for patch
package objvisitor

import (
	"errors"
	"fmt"

	"github.com/RICE-COMP318-FALL23/owldb-p1group06/jsonvisit"
)

// Objvisitor represents an object visitor used for JSON patching.
type Objvisitor struct {
	path []string
	data any
	op   string
}

// New creates a new Objvisitor instance with the specified path, data, and operation.
func New(path []string, data any, op string) Objvisitor {
	return Objvisitor{path: path, data: data, op: op}
}

// Map processes JSON Map by iterating through map and calling Accept.
func (v Objvisitor) Map(m map[string]any) (any, error) {
	op := v.op
	path := v.path
	if op == "ObjectAdd" && len(v.path) == 0 {
		_, exist := m[""]
		if exist {
			return m, nil
		}
		m[""] = v.data
		return m, nil
	}
	if op == "ObjectAdd" && len(v.path) == 1 {
		key := v.path[0]
		_, exist := m[key]
		if exist {
			return m, nil
		}
		m[key] = v.data
		return m, nil
	}
	if len(v.path) > 0 {
		_, exist := m[path[0]]
		if !exist {
			return nil, errors.New("error applying patches: map has no key in the middle of the path")
		}
	}

	if len(v.path) > 0 {
		newMap := make(map[string]any)
		for key, val := range m {
			if key == path[0] {
				v.path = path[1:]
				data, err := jsonvisit.Accept(val, v)
				if err != nil {
					return nil, errors.New("applying patches: path ends in object")
				}
				newMap[key] = data

			} else {
				newMap[key] = val
			}
		}
		return newMap, nil
	}
	return nil, errors.New("invalid type")
}

// Slice processes JSON slice by iterating through slice and calling Accept.
func (v Objvisitor) Slice(s []any) (any, error) {
	data := v.data

	if len(v.path) == 0 {
		if v.op == "ObjectAdd" {
			return nil, errors.New("cannot perform ObjectAdd in Slice")
		}
		idx := -1
		for i, file := range s {
			same := jsonvisit.Equal(file, data)
			if same {
				idx = i
				break
			}
		}
		if v.op == "ArrayRemove" {
			if idx != -1 {
				fmt.Println(idx)
				s = append(s[:idx], s[idx+1:]...)
				fmt.Println(s)

			}
			return s, nil
		}
		if idx == -1 {
			s = append(s, data)

		}
		return s, nil

	}
	return nil, errors.New("invalid patch, unfinished in Slice")
}

// Bool processes JSON bool by printing bool
func (v Objvisitor) Bool(b bool) (any, error) {
	if len(v.path) != 0 {
		return nil, errors.New("invalid patch, unfinished")
	}
	return b, nil
}

// Float64 processes JSON float
func (v Objvisitor) Float64(f float64) (any, error) {
	if len(v.path) != 0 {
		return nil, errors.New("invalid patch, unfinished")
	}
	return f, nil
}

// String processes JSON string
func (v Objvisitor) String(s string) (any, error) {
	if len(v.path) != 0 {
		return nil, errors.New("invalid patch, unfinished")
	}
	return s, nil
}

// Null processes JSON null value
func (v Objvisitor) Null() (any, error) {
	if len(v.path) != 0 {
		return nil, errors.New("invalid patch, unfinished")
	}
	return nil, nil
}
