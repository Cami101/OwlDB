// Test cases for suthentication.
package authentication

import (
	"os"
	"strconv"
	"sync"
	"testing"
)

// Test the ability to map a token to a user.
func TestMapToken(t *testing.T) {
	ut := New()
	token, err := ut.MapToken("user1")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if token == "" {
		t.Errorf("expected non-empty token, got empty token")
	}
}

// Test if a valid token returns the correct user.
func TestCheckToken(t *testing.T) {
	ut := New()
	token, _ := ut.MapToken("user1")
	user := ut.CheckToken(token)
	if user != "user1" {
		t.Errorf("expected username 'user1', got '%v'", user)
	}
}

// Test if deleting a token works correctly.
func TestDeleteToken(t *testing.T) {
	ut := New()
	token, _ := ut.MapToken("user1")

	status := ut.DeleteToken(token)
	if status != 204 {
		t.Errorf("expected HTTP status 204, got %v", status)
	}

	user := ut.CheckToken(token)
	if user != "" {
		t.Errorf("expected empty username, got '%v'", user)
	}
}

// Test reading from a token file and setting tokens to not expire (24 hours).
func TestUnexpiredToken(t *testing.T) {
	tokenFileContent := `{"user1":"sampletoken"}`

	err := os.WriteFile("testTokenFile.json", []byte(tokenFileContent), 0644)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer os.Remove("testTokenFile.json")

	ut := New()
	err = ut.UnexpiredToken("testTokenFile.json")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	user := ut.CheckToken("sampletoken")
	if user != "user1" {
		t.Errorf("expected username 'user1', got '%v'", user)
	}
}

// Test that the token generation produces unique tokens.
func TestGenerateTokenUnique(t *testing.T) {
	tokenSet := make(map[string]bool)
	for i := 0; i < 1000000; i++ {
		token, err := generateToken()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if _, exists := tokenSet[token]; exists {
			t.Errorf("duplicate token generated: %v", token)
			return
		}
		tokenSet[token] = true
	}
}

// Test mapping a token with an empty user string.
func TestMapTokenEmptyUser(t *testing.T) {
	ut := New()
	_, err := ut.MapToken("")
	if err == nil {
		t.Errorf("expected error for empty user, got nil")
	}
}

// Test reading from an invalid (nonexistent) token file.
func TestUnexpiredTokenInvalidFile(t *testing.T) {
	ut := New()
	err := ut.UnexpiredToken("nonexistentfile.json")
	if err == nil {
		t.Errorf("expected error for nonexistent file, got nil")
	}
}

// Test reading from a token file with invalid JSON content.
func TestUnexpiredTokenInvalidJSON(t *testing.T) {
	tokenFileContent := `{"user1":"sampletoken",}`

	err := os.WriteFile("invalidTokenFile.json", []byte(tokenFileContent), 0644)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer os.Remove("invalidTokenFile.json")

	ut := New()
	err = ut.UnexpiredToken("invalidTokenFile.json")
	if err == nil {
		t.Errorf("expected error for invalid JSON, got nil")
	}
}

// Test reading multiple tokens from a file and checking their validity.
func TestUnexpiredTokenMultipleUsers(t *testing.T) {
	tokenFileContent := `{
		"user1":"sampletoken1",
		"user2":"sampletoken2"
	}`

	err := os.WriteFile("multiUserTokenFile.json", []byte(tokenFileContent), 0644)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer os.Remove("multiUserTokenFile.json")

	ut := New()
	err = ut.UnexpiredToken("multiUserTokenFile.json")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	user1 := ut.CheckToken("sampletoken1")
	if user1 != "user1" {
		t.Errorf("expected username 'user1', got '%v'", user1)
	}

	user2 := ut.CheckToken("sampletoken2")
	if user2 != "user2" {
		t.Errorf("expected username 'user2', got '%v'", user2)
	}
}

// Test deleting a token that doesn't exist.
func TestDeleteNonexistentToken(t *testing.T) {
	ut := New()

	status := ut.DeleteToken("nonexistentToken")
	if status != 401 {
		t.Errorf("expected HTTP status 401, got %v", status)
	}
}

// Test concurrent mapping of tokens to users.
func TestConcurrentMapToken(t *testing.T) {
	const numGoroutines = 100
	ut := New()

	var wg sync.WaitGroup
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			user := "user" + strconv.Itoa(i)
			_, err := ut.MapToken(user)
			if err != nil {
				t.Errorf("unexpected error for user %v: %v", user, err)
			}
		}(i)
	}
	wg.Wait()
}

// Test concurrent deletion of tokens.
func TestConcurrentDeleteToken(t *testing.T) {
	const numGoroutines = 100
	ut := New()

	// map tokens for all users
	tokens := make([]string, numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		user := "user" + strconv.Itoa(i)
		token, err := ut.MapToken(user)
		if err != nil {
			t.Fatalf("unexpected error for user %v: %v", user, err)
		}
		tokens[i] = token
	}

	var wg sync.WaitGroup
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			status := ut.DeleteToken(tokens[i])
			if status != 204 {
				t.Errorf("expected HTTP status 204 for token %v, got %v", tokens[i], status)
			}
		}(i)
	}
	wg.Wait()
}

// Test concurrent checks of tokens.
func TestConcurrentCheckToken(t *testing.T) {
	const numGoroutines = 100
	ut := New()

	// map tokens for all users
	tokens := make([]string, numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		user := "user" + strconv.Itoa(i)
		token, err := ut.MapToken(user)
		if err != nil {
			t.Fatalf("unexpected error for user %v: %v", user, err)
		}
		tokens[i] = token
	}

	var wg sync.WaitGroup
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			user := ut.CheckToken(tokens[i])
			expectedUser := "user" + strconv.Itoa(i)
			if user != expectedUser {
				t.Errorf("expected username '%v', got '%v'", expectedUser, user)
			}
		}(i)
	}
	wg.Wait()
}
