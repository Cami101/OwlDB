// Package main is the entry point for the database, which sets up an HTTP server and handles requests.

package main

import (
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/RICE-COMP318-FALL23/owldb-p1group06/system"
)

func main() {
	var port int
	var err error
	var server http.Server

	// Your code goes here.

	var tokens string
	var schema string

	//get port, tokens, and schema
	flag.IntVar(&port, "p", 3318, "Port number to listen on")
	flag.StringVar(&tokens, "t", "", "Path to the file of string tokens")
	flag.StringVar(&schema, "s", "", "Path to the JSON Schema file")
	flag.Parse()

	// Set the handler
	server.Addr = fmt.Sprintf(":%d", port)
	server.Handler, err = system.New(tokens, schema)
	if err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}

	// The following code should go last and remain unchanged.
	// Note that you must actually initialize 'server' and 'port'
	// before this.

	// signal.Notify requires the channel to be buffered
	ctrlc := make(chan os.Signal, 1)
	signal.Notify(ctrlc, os.Interrupt, syscall.SIGTERM)
	go func() {
		// Wait for Ctrl-C signal
		<-ctrlc
		server.Close()
	}()

	// Start server
	slog.Info("Listening", "port", port)
	err = server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		slog.Error("Server closed", "error", err)
	} else {
		slog.Info("Server closed", "error", err)
	}
}
