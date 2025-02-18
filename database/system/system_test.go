// Test cases for system.
package system

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/RICE-COMP318-FALL23/owldb-p1group06/authentication"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/subscription"
)

// initSystem initializes a new System using the specified schema file.
// Returns an instance of the System.
func initSystem() System {
	sys, _ := NewSystem("../schema.json")
	return sys
}

// TestHandler tests the handling of various HTTP requests by the system.
// This includes authentication and various database operations like put and delete.
// Each operation is tested for correct response based on the swagger documentation.
func TestHandler(t *testing.T) {
	s := initSystem()
	auth := authentication.New()
	authreader := bytes.NewBufferString("{\"username\": \"a_user\"}")
	response := httptest.NewRecorder()
	r0, _ := http.NewRequest("POST", "/auth/", authreader)
	r0.Header.Set("Accept", "application/json")
	r0.Header.Set("Content-Type", "application/json")
	s.handleAuth(response, r0, &auth)
	token := response.Body.String()
	token = strings.Split(token, ":")[1]
	token = token[1 : len(token)-2]

	body := []byte("{}")
	reader := bytes.NewReader(body)
	r1, _ := http.NewRequest("PUT", "/v1/db1", reader)
	r1.Header.Set("Accept", "application/json")
	r1.Header.Set("Authorization", "token: "+token)

	response = httptest.NewRecorder()
	sub := subscription.New()
	s.handleRequest(response, r1, &auth, &sub)

	resp := response.Body.String()

	if resp != "{\"uri\":\"/v1/db1\"}" {
		t.Error("Response doesn't match swagger on db put")
	}

	body = []byte("{\"additionalProp1\": \"string\", \"additionalProp2\": \"string\", \"additionalProp3\": \"string\"}")
	reader = bytes.NewReader(body)
	r2, _ := http.NewRequest("PUT", "/v1/db1/doc1", reader)
	r2.Header.Set("Accept", "application/json")
	r2.Header.Set("Authorization", "token: "+token)
	r2.Header.Set("Content-Type", "application/json")
	response = httptest.NewRecorder()
	s.handleRequest(response, r2, &auth, &sub)
	resp = response.Body.String()

	if resp != "{\"uri\":\"/v1/db1/doc1\"}" {
		t.Error("Response doesn't match swagger on doc put")
	}

	body = []byte("")
	reader = bytes.NewReader(body)
	r3, _ := http.NewRequest("DELETE", "/v1/db1", reader)
	r3.Header.Set("Accept", "*/*")
	r3.Header.Set("Authorization", "Bearer "+token)
	response = httptest.NewRecorder()
	s.handleRequest(response, r3, &auth, &sub)
	resp = response.Body.String()
	if resp != "\"Database Successfully Deleted\"" {
		t.Error("Response does not match swagger on db delete")
	}

}

// TestInitServer tests the initialization of the server using the given configuration and schema files.
// It checks if the server is successfully initialized without any errors.
func TestInitServer(t *testing.T) {
	_, err := New("../uexptok.json", "../schema.json")
	if err != nil {
		t.Error("Server initialization failed")
	}

}
