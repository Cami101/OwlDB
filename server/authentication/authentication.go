// Package to deal with everything related to authentication, including tokens
// and authorization
package authentication

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"github.com/RICE-COMP318-FALL23/owldb-p1group06/skiplist"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// UserToken manages a skip list of tokens associated with users.
type UserToken struct {
	Records skiplist.SkipList[string, User]
}

// User represents information about a user, including their start time
// (which can be used to check token expiration) and their username.
type User struct {
	StartTime time.Time
	UserName  string
}

// UserString is a structure to unmarshal or marshal user details from/to JSON.
type UserString struct {
	Username string
}

// Token is a structure to hold a token in string format.
// Used for JSON marshaling and unmarshaling.
type Token struct {
	Token string `json:"token"`
}

// New initializes a new UserToken instance.
// Returns a new instance of the UserToken type.
func New() UserToken {
	var list skiplist.SkipList[string, User]
	list.MakeSkipList()
	new := UserToken{
		Records: list,
	}
	return new
}

// MapToken associates a token with the given user.
// Returns the generated token and any potential errors.
func (u *UserToken) MapToken(user string) (string, error) {
	if user == "" {
		return "", errors.New("No username in request body")
	}

	// generate token for the user
	token, err := generateToken()
	if err != nil {
		return "", err
	}
	var userInfo User
	userInfo.StartTime = time.Now()
	userInfo.UserName = user

	check := func(key string, currVal User, exists bool) (newValue User, err error) {
		if !exists {
			return userInfo, nil
		}
		return userInfo, errors.New("coincidence: same token")
	}
	success, err := u.Records.Upsert(token, check)
	if err != nil {
		slog.Error("coincidence: same token")
	}
	if !success {
		slog.Error("Put token failed")
	}
	return token, nil
}

// generateToken produces a new random token for user authentication.
// Returns a generated token and an error.
func generateToken() (string, error) {
	var token string
	// Change if needed
	numBytes := 12
	// Generate random bytes
	bytes := make([]byte, numBytes)
	_, err := rand.Read(bytes)
	if err != nil {
		return token, err
	}
	token = base64.StdEncoding.EncodeToString(bytes)
	token = strings.ReplaceAll(token, "/", "-")
	token = strings.ReplaceAll(token, "\\", "-")
	// Encode the random bytes to base64 to get a token
	return token, nil
}

// DeleteToken removes the given token from the skip list.
// Returns an HTTP status code based on the outcome.
func (u *UserToken) DeleteToken(token string) int {
	_, exists := u.Records.Find(token)
	if !exists {
		return http.StatusUnauthorized
	}

	u.Records.Delete(token)
	return http.StatusNoContent
}

// CheckToken verifies the validity of the provided token.
// Returns the username associated with the token if valid, otherwise returns an empty string.
func (u *UserToken) CheckToken(token string) string {
	user, exists := u.Records.Find(token)
	if !exists {
		return ""
	}

	if u.checkExpiration(token) {
		// Token expired.
		return ""
	}
	// Success.
	return user.GetVal().UserName
}

// checkExpiration checks if the token has expired based on its start time.
// Tokens are valid for 1 hour after their start time.
// Returns true if the token has expired, false otherwise.
func (u *UserToken) checkExpiration(token string) bool {
	curTime := time.Now()
	user, _ := u.Records.Find(token)
	if curTime.Sub(user.GetVal().StartTime) > time.Hour {
		u.Records.Delete(token)
		return true
	}
	return false
}

// UnexpiredToken reads a given token file and sets its start time
// to ensure it does not expire for 24 hours.
// Returns an error if there's an issue reading the token file or unmarshalling its content.
// Used for -t command.
func (u *UserToken) UnexpiredToken(token string) error {
	tok, err := os.ReadFile(token)
	if err != nil {
		slog.Error("Failed to read token file, ", err)
		return err
	}

	var tokenFile map[string]string
	err = json.Unmarshal(tok, &tokenFile)
	if err != nil {
		slog.Error("Failed to unmarshal token file, ", err)
		return err
	}

	for user, token := range tokenFile {
		var userInf User
		// set time to 23 hour in the future so that it expires in 24 hours
		userInf.StartTime = time.Now().Add(23 * time.Hour)
		userInf.UserName = user
		check := func(key string, currVal User, exists bool) (newValue User, err error) {
			if !exists {
				return userInf, nil
			}
			return userInf, errors.New("coincidence: same token")
		}
		success, err := u.Records.Upsert(token, check)
		if err != nil {
			slog.Error("coincidence: same token")
		}
		if !success {
			slog.Error("Put token failed")
		}
	}
	return nil
}
