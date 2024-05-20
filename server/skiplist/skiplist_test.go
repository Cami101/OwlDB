// Package to test the skip list package
package skiplist

import (
	"crypto/rand"
	"encoding/hex"
	"sort"
	"sync"
	"testing"

	"github.com/RICE-COMP318-FALL23/owldb-p1group06/filejson"
)

type TimeTester struct {
	lastModifiedAt int64
}

func (t TimeTester) GetLastModifiedAt() int64 {
	return t.lastModifiedAt
}

// Initializes a set of test data for the skip list tests.
func InitTests(t *testing.T) map[string]*SkipList[string, filejson.FileJson] {
	tests := make(map[string]*SkipList[string, filejson.FileJson])

	test1 := SkipList[string, filejson.FileJson]{}
	test1.MakeSkipList()
	t1node2 := test1.NewNode("node2", test1.tail, 0)
	t1node1 := test1.NewNode("node1", t1node2, 0)
	test1.head.next[0].Store(t1node1)
	tests["test1"] = &test1
	return tests
}

// Tests basic sequential operations on the skip list: finding, inserting, and deleting nodes.
func TestSequential1(t *testing.T) {
	tests := InitTests(t)
	test1 := tests["test1"]

	// Testing find
	result1node, result1bool := test1.Find("node1")
	if result1node.key != "node1" || result1bool != true {
		t.Errorf("test1: found %s, %t but expected key1, true", result1node.key, result1bool)
	}

	result2node, result2bool := test1.Find("node2")
	if result2node.key != "node2" || result1bool != true {
		t.Errorf("test1: found %s, %t but expected key2, true", result2node.key, result2bool)
	}

	// Testing a single insert
	var nilInterface filejson.FileJson
	check := func(key string, currVal filejson.FileJson, exists bool) (newValue filejson.FileJson, err error) {
		return nilInterface, err
	}
	testinsert1, _ := test1.Upsert("key12", check)
	if !testinsert1 {
		t.Error("testinsert1 failed")
	}

	// Testing a single delete
	testdelete1node, testdelete1bool := test1.Delete("node1")
	if testdelete1node != result1node || !testdelete1bool {
		t.Errorf("testdelete1: wrong node removed, or delete failed: %t should be true", testdelete1bool)
	}

}

// Tests concurrent operations on the skip list: inserting and deleting nodes.
func TestConcurrency1(t *testing.T) {
	tests := InitTests(t)
	test1 := tests["test1"]
	var nilInterface filejson.FileJson
	check := func(key string, currVal filejson.FileJson, exists bool) (newValue filejson.FileJson, err error) {
		return nilInterface, err
	}
	var testinsert1, testinsert2, testinsert3, testinsert4,
		node1bool, node2bool, node3bool, node5bool, node6bool bool
	var node1deleted, node2deleted,
		node3deleted, node5deleted,
		node6deleted *Node[string, filejson.FileJson]
	var wg sync.WaitGroup
	wg.Add(4)

	// Testing concurrent inserts
	go func() {
		testinsert1, _ = test1.Upsert("node3", check)
		wg.Done()
	}()
	go func() {
		testinsert2, _ = test1.Upsert("node4", check)
		wg.Done()
	}()
	go func() {
		testinsert3, _ = test1.Upsert("node5", check)
		wg.Done()
	}()
	go func() {
		testinsert4, _ = test1.Upsert("node6", check)
		wg.Done()
	}()

	wg.Wait()
	if !testinsert1 || !testinsert2 || !testinsert3 || !testinsert4 {
		t.Error("Concurrent insert test 1 failed!")
	}

	// Checking the order of inserted nodes

	head := test1.head
	if head.next[0].Load().key != "node1" {
		t.Errorf("node1 misplaced, found %s", head.next[0].Load().key)
	}
	if head.next[0].Load().next[0].Load().key != "node2" {
		t.Errorf("node2 misplaced, found %s", head.next[0].Load().next[0].Load().key)
	}
	if head.next[0].Load().next[0].Load().next[0].Load().key != "node3" {
		t.Errorf("node3 misplaced, found %s", head.next[0].Load().next[0].Load().next[0].Load().key)
	}
	if head.next[0].Load().next[0].Load().next[0].Load().next[0].Load().key != "node4" {
		t.Errorf("node4 misplaced, found %s", head.next[0].Load().next[0].Load().next[0].Load().next[0].Load().key)
	}
	if head.next[0].Load().next[0].Load().next[0].Load().next[0].Load().next[0].Load().key != "node5" {
		t.Errorf("node5 misplaced, found %s", head.next[0].Load().next[0].Load().next[0].Load().next[0].Load().next[0].Load().key)
	}
	if head.next[0].Load().next[0].Load().next[0].Load().next[0].Load().next[0].Load().next[0].Load().key != "node6" {
		t.Errorf("node6 misplaced, found %s", head.next[0].Load().next[0].Load().next[0].Load().next[0].Load().next[0].Load().next[0].Load().key)
	}

	// Testing concurrent deletes
	wg.Add(5)

	go func() {
		node1deleted, node1bool = test1.Delete("node1")
		wg.Done()
	}()
	go func() {
		node2deleted, node2bool = test1.Delete("node2")
		wg.Done()
	}()
	go func() {
		node3deleted, node3bool = test1.Delete("node3")
		wg.Done()
	}()
	go func() {
		node5deleted, node5bool = test1.Delete("node5")
		wg.Done()
	}()
	go func() {
		node6deleted, node6bool = test1.Delete("node6")
		wg.Done()
	}()

	wg.Wait()

	if node1deleted.key != "node1" ||
		node2deleted.key != "node2" ||
		node3deleted.key != "node3" ||
		node5deleted.key != "node5" ||
		node6deleted.key != "node6" {
		t.Errorf("concurrent delete returned mismatched nodes: "+
			" expected `node1, node2, node3, node5, node6` but received:"+
			"%s, %s, %s, %s, %s,", node1deleted.key, node2deleted.key,
			node3deleted.key, node5deleted.key, node6deleted.key)
	}

	if !node1bool || !node2bool ||
		!node3bool || !node5bool ||
		!node6bool {
		t.Error("concurrent delete failed, received a false bool value")
	}

	// Making sure only node4 is in the list
	_, node1found := test1.Find("node1")
	_, node2found := test1.Find("node2")
	_, node3found := test1.Find("node3")
	_, node4found := test1.Find("node4")
	_, node5found := test1.Find("node5")
	_, node6found := test1.Find("node6")

	if node1found {
		t.Error("concurrent delete failed: node1 found in the list")
	}
	if node2found {
		t.Error("concurrent delete failed: node1 found in the list")
	}
	if node3found {
		t.Error("concurrent delete failed: node1 found in the list")
	}
	if !node4found {
		t.Error("concurrent delete failed: node4 not found in the list")
	}
	if node5found {
		t.Error("concurrent delete failed: node1 found in the list")
	}
	if node6found {
		t.Error("concurrent delete failed: node1 found in the list")
	}

	// Check to see if the levels were properly randomized
	// Will usually be commented out to avoid clutter
	//t.Logf("Checking max levels of each node added with insert: %d, %d, %d"+
	//	"\nThese should be random between 0-4 but the sample size is small",
	//	node3deleted.topLevel, node5deleted.topLevel, node6deleted.topLevel)
}

// Tests the skip list's behavior with concurrent insertion and deletion of randomly generated keys.
func TestConcurrency2(t *testing.T) {
	test := SkipList[string, filejson.FileJson]{}
	totalKeys := 50
	var json filejson.FileJson
	check := func(key string, currVal filejson.FileJson, exists bool) (newValue filejson.FileJson, err error) {
		return json, err
	}
	test.MakeSkipList()
	keys := make([]string, totalKeys)
	var wg sync.WaitGroup
	wg.Add(totalKeys)
	// Build array of random keys
	for i := 0; i < totalKeys; i++ {
		str := getRandomKey()
		if contains(str, keys) {
			i--
		} else {
			keys[i] = str
		}
	}
	toRemove := keys[:20]
	remaining := keys[20:]
	// Concurrently insert totalKeys keys
	for i := 0; i < totalKeys; i++ {
		j := i
		go func() {
			failed, _ := test.Upsert(keys[j], check)
			if !failed {
				t.Logf("key %s failed", keys[j])
			}
			wg.Done()
		}()
	}
	wg.Wait()
	// Check to see if keys were inserted properly
	sort.Strings(keys)
	node := test.head.next[0].Load()
	failed := false
	count := 0
	// Check if there are the right number of keys
	for node != test.tail {
		count++
		node = node.next[0].Load()
	}
	if count != totalKeys {
		t.Errorf("Found %d nodes but expected %d nodes", count, totalKeys)
	}
	node = test.head.next[0].Load()
	// Make sure the ordering of keys is correct
	for i := 0; i < totalKeys; i++ {
		if node.key != keys[i] {
			failed = true
			// Could be commented out to avoid clutter
			t.Logf("Error in key insertion. Expected %s but found %s", keys[i], node.key)
		}
		node = node.next[0].Load()
	}
	if failed {
		t.Error("Concurrent insertion of random keys failed")
	}
	// Insertion was a success!

	// Testing concurrent insertion and deletion
	toInsert := make([]string, 20)
	for i := 0; i < 20; i++ {
		str := getRandomKey()
		if contains(str, toInsert) {
			i--
		} else {
			toInsert[i] = str
		}
	}
	remaining = append(remaining, toInsert...)
	sort.Strings(remaining)
	wg.Add(40)
	failed = false
	// Insert and delete 20 nodes concurrently
	for i := 0; i < 20; i++ {
		j := i
		go func() {
			succ, _ := test.Upsert(toInsert[j], check)
			if !succ {
				failed = true
			}
			wg.Done()
		}()
		go func() {
			_, success := test.Delete(toRemove[j])
			if !success {
				failed = true
			}
			wg.Done()
		}()
	}
	wg.Wait()

	if failed {
		t.Error("Concurrent insert and delete failed")
	}

	node = test.head.next[0].Load()
	for i := 0; i < totalKeys; i++ {
		if node.key != remaining[i] {
			failed = true
			// Could be commented out to avoid clutter
			t.Logf("Error in key insertion/deletion. Expected %s but found %s", keys[i], node.key)
		}
		node = node.next[0].Load()
	}

	if failed {
		t.Error("Nodes in wrong order in insertion/deletion")
	}

}

// Repeatedly runs the concurrent tests to ensure the skip list behaves consistently under concurrent operations.
func TestConcurrencyRepeated(t *testing.T) {

	// Runs the concurrent tests 1000 times over, ensuring it works
	// while also testing the randomization of levels if enabled
	for i := 0; i < 10000; i++ {
		TestConcurrency1(t)
	}

	for i := 0; i < 10000; i++ {
		TestConcurrency2(t)
	}
}

// Tests the retrieval of the head and last nodes from the skip list.
func TestGetNodes(t *testing.T) {
	tests := InitTests(t)
	test1 := tests["test1"]

	if test1.GetHeadNode() != test1.head {
		t.Error("GetHeadNode did not access head node!")
	}
	if test1.GetLastNode().next[0].Load() != test1.tail {
		t.Error("GetLastNode did now access last node!")
	}
}

// Tests the behavior of the skip list when the same node is inserted and deleted multiple times.
func TestRepeatedInputs(t *testing.T) {
	tests := InitTests(t)
	test1 := tests["test1"]
	var json filejson.FileJson
	check := func(key string, currVal filejson.FileJson, exists bool) (newValue filejson.FileJson, err error) {
		return json, err
	}

	// Testing inserting same node twice
	success1, _ := test1.Upsert("node1a", check)
	success2, _ := test1.Upsert("node1a", check)
	if !success1 || !success2 {
		t.Errorf("Expected true, true but received: %t, %t on inserting same node twice",
			success1, success2)
	}
	if test1.head.next[0].Load().next[0].Load().key != "node1a" {
		t.Errorf("Node inserted in wrong spot or not at all")
	}
	// Testing deleting same node twice
	_, success1 = test1.Delete("node1a")
	_, success2 = test1.Delete("node1a")
	if !success1 || success2 {
		t.Errorf("Expected true, false but received: %t, %t on deleting same node twice",
			success1, success2)
	}
	// Run the same tests but concurrently
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		success1, _ = test1.Upsert("node1a", check)
		wg.Done()
	}()
	go func() {
		success2, _ = test1.Upsert("node1a", check)
		wg.Done()
	}()
	wg.Wait()
	if !(success1 && success2) {
		t.Errorf("Expected distinct values but received: %t, %t on inserting same node twice",
			success1, success2)
	}
	if test1.head.next[0].Load().next[0].Load().key != "node1a" {
		t.Errorf("Node inserted in wrong spot or not at all")
	}
	// Now do the same with delete
	wg.Add(2)
	go func() {
		_, success1 = test1.Delete("node1a")
		wg.Done()
	}()
	go func() {
		_, success2 = test1.Delete("node1a")
		wg.Done()
	}()
	wg.Wait()
	if (success1 && success2) || !(success1 || success2) {
		t.Errorf("Expected distinct values but received: %t, %t on deleting same node twice",
			success1, success2)
	}
}

// Tests querying nodes between two keys in the skip list.
// Also tests querying in a concurrent environment where node values are being modified.
func TestQuery(t *testing.T) {

	test := SkipList[string, TimeTester]{}
	test.MakeSkipList()
	keys := make([]string, 20)
	var json TimeTester
	check := func(key string, currVal TimeTester, exists bool) (newValue TimeTester, err error) {
		return json, err
	}
	for i := 0; i < 20; i++ {
		str := getRandomKey()
		if contains(str, keys) {
			i--
		} else {
			keys[i] = str
			test.Upsert(str, check)
		}
	}
	sort.Strings(keys)

	// Test query
	nodes, success := test.Query(nil, keys[4], keys[14])
	if !success {
		t.Error("Query failed")
	}
	for i := 0; i < 10; i++ {
		if keys[i+4] != nodes[i].key {
			t.Errorf("Error in query: expected %s, received %s", keys[i], nodes[i].key)
		}
	}
	// Test Query while nodes are being changed, not sure how deterministic the test will be though
	var wg sync.WaitGroup
	wg.Add(5)
	var nodes2 []*Node[string, TimeTester]
	go func() {
		nodes2, success = test.Query(nil, keys[4], keys[14])
		t.Log("Query finished")
		if !success {
			t.Error("Query failed")
		}
		wg.Done()
	}()
	go func() {
		nodes[2].value.lastModifiedAt = 5
		t.Log("Node 2 finished")
		wg.Done()
	}()
	go func() {
		nodes[5].value.lastModifiedAt = 8
		t.Log("Node 5 finished")
		wg.Done()
	}()
	go func() {
		nodes[7].value.lastModifiedAt = 10
		t.Log("Node 7 finished")
		wg.Done()
	}()
	go func() {
		nodes[10].value.lastModifiedAt = 12
		t.Log("Node 10 finished")
		wg.Done()
	}()
	wg.Wait()
	// This case isn't deterministic by the nature of concurrency, so we
	// will run it multiple times and check the output for patterns
	for i := 0; i < len(nodes2); i++ {
		if keys[i+4] != nodes2[i].key {
			t.Errorf("Error in concurrent query: expected %s, received %s", keys[i], nodes[i].key)
		}
		t.Logf("For node %d: current timestamp = %d, query timestamp = %d",
			i, nodes[i].value.lastModifiedAt, nodes2[i].value.lastModifiedAt)
	}
}

// Generates a random string to be used as a key for the skip list.
func getRandomKey() string {
	bytes := make([]byte, 5)
	rand.Read(bytes)
	str := hex.EncodeToString(bytes)
	return str
}

// Checks if a given string key exists in an array of strings.
func contains(key string, arr []string) bool {
	for _, str := range arr {
		if str == key {
			return true
		}
	}
	return false
}
