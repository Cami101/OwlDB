// A package creating the concurrent skip list data structure
package skiplist

import (
	"cmp"
	"context"
	"sync/atomic"
	"time"

	//"log/slog"
	"math/rand"
	"sync"
)

// The concurrent skip list data structure capable of storing,
// deleting, and accessing key value pairs concurrently where
// the key of each node must be comparable.
type SkipList[K cmp.Ordered, V any] struct {
	head *Node[K, V] // Head node
	tail *Node[K, V] // Tail node
}

// Helper function to insertion that gives the caller more control
// over how to use the result.
type UpdateCheck[K cmp.Ordered, V any] func(key K, currValue V, exists bool) (newValue V, err error)

// Struct for a node within a skip list.
type Node[K cmp.Ordered, V any] struct {
	sync.Mutex                               // Lock for the given node
	key         K                            // Key of type comparable
	value       V                            // Value stored in the node
	topLevel    int                          // Height of the node
	marked      atomic.Bool                  // Whether or not this node is currently being deleted
	fullyLinked atomic.Bool                  // Whether or not this node is currently being inserted
	next        []atomic.Pointer[Node[K, V]] // A slice of next pointers, representing the next node at each level
	time        atomic.Int64                 // Timestamp of when the node was inserted or last updated
}

// Returns the key of the node called on
func (node *Node[K, V]) GetKey() K {
	return node.key
}

// Returns the value of the key called on
func (node *Node[K, V]) GetVal() V {
	return node.value
}

// Checks to see if the current key was found within the skip list.
// Returns the node if found and a bool representing if it was found.
func (list *SkipList[K, V]) Find(key K) (*Node[K, V], bool) {
	var found *Node[K, V]
	_, succs, level := list.getPredSucc(key)
	if level == -1 {
		return found, false
	}
	found = succs[level]
	return found, found.fullyLinked.Load() && !found.marked.Load()
}

// Inserts a node at key K into the skip list called on, or if the node already
// exists either updated it or ignores it based on the function check passed
// by the caller. The value of the given node is also passed in with check.
func (list *SkipList[K, V]) Upsert(key K, check UpdateCheck[K, V]) (bool, error) {
	level := GetLevel()
	var oldVal V
	var exists bool
	// Loops until fail or success
	for {
		// Get predecessors and successors of node at key K
		preds, succs, levelFound := list.getPredSucc(key)
		if levelFound != -1 {
			exists = true
			// Node already exists
			found := succs[levelFound]
			if found.marked.Load() {
				// continue if node is found and marked
				continue
			}
			// Lock the node being updated
			succs[0].Lock()
			valid := true
			// Lock all predecessors
			var prev *Node[K, V]
			for _, pred := range preds {
				if pred != prev {
					pred.Lock()
				}
				prev = pred
			}
			// Check if predecessors are valid
			prev = nil
			for index, pred := range preds {
				if !pred.fullyLinked.Load() || pred.marked.Load() {
					valid = false
				}
				if pred.next[index].Load() != succs[index] {
					valid = false
				}
			}
			// If predecessors are invalid, unlock and try again
			if !valid {
				succs[0].Unlock()
				prev = nil
				for _, pred := range preds {
					if pred != prev {
						pred.Unlock()
					}
					prev = pred
				}
				prev = nil
			} else { // Insert the node
				node := succs[0]
				newVal, err := check(key, oldVal, exists)
				if err != nil {
					// Return an error if update fails
					return false, err
				}
				// Update time field
				node.value = newVal
				node.time.Store(time.Now().UnixMilli())
				// Unlock all predecessors and current node
				prev = nil
				for _, pred := range preds {
					if pred != prev {
						pred.Unlock()
					}
					prev = pred
				}
				prev = nil
				succs[0].Unlock()
				return true, nil
			}
		} else {
			// Node does not exist, needs to be inserted
			exists = false
			valid := true
			// Lock all predecessors
			var prev *Node[K, V]
			for idx, pred := range preds {
				if pred != prev && idx <= level {
					pred.Lock()
				}
				prev = pred
			}
			// Check if predecessors are valid
			prev = nil
			for index, pred := range preds {
				if !pred.fullyLinked.Load() || pred.marked.Load() {
					valid = false
				}
				if pred.next[index].Load() != succs[index] {
					valid = false
				}
			}
			// If predecessors are invalid, unlock them and try again
			if !valid {
				prev = nil
				for idx, pred := range preds {
					if pred != prev && idx <= level {
						pred.Unlock()
					}
					prev = pred
				}
				prev = nil
			} else { // Insert the node
				newVal, err := check(key, oldVal, exists)
				if err != nil {
					return false, err
				}
				// Construct node ot be inserted
				node := &Node[K, V]{
					key:      key,
					value:    newVal,
					next:     make([]atomic.Pointer[Node[K, V]], level+1),
					topLevel: level,
				}
				node.time.Store(time.Now().UnixMilli())
				for i := 0; i <= level; i++ {
					node.next[i].Store(succs[i])
					preds[i].next[i].Store(node)
				}
				node.fullyLinked.Store(true)
				// Unlock all predecessors
				prev = nil
				for idx, pred := range preds {
					if pred != prev && idx <= level {
						pred.Unlock()
					}
					prev = pred
				}
				return true, nil
			}
		}
	}
}

// Deletes a node at key k, returning the node if successfully
// deleted and a bool representing if the function was successful
func (list *SkipList[K, V]) Delete(key K) (*Node[K, V], bool) {
	var remove *Node[K, V]
	var dummyNode *Node[K, V]
	marked := false
	topLevel := -1
	var prev *Node[K, V]
	// Loop until success
	for {
		valid := true
		preds, succs, levelFound := list.getPredSucc(key)
		if levelFound != -1 {
			remove = succs[levelFound]
		} else {
			// Node at key passed not found
			return dummyNode, false
		}

		// For first iteration
		if !marked {
			// Make sure node is valid
			if !remove.fullyLinked.Load() || remove.marked.Load() ||
				remove.topLevel != levelFound {
				return dummyNode, false
			}
			topLevel = remove.topLevel
			// Node is valid, lock the node and check to see if it is still valid
			remove.Lock()
			if remove.marked.Load() {
				remove.Unlock()
				return dummyNode, false
			}
			// Mark the node
			remove.marked.Store(true)
			// End first iteration
			marked = true
		}
		// Lock all predecessors
		for _, pred := range preds {
			if pred != prev {
				pred.Lock()
			}
			prev = pred
		}
		prev = nil

		// Check to see if node is still valid
		for index, pred := range preds {
			if !pred.fullyLinked.Load() || pred.marked.Load() {
				valid = false
			}
			if pred.next[index].Load() != succs[index] {
				valid = false
			}
		}
		// Node is invalid, unlock predecessors and restart
		if !valid {
			prev = nil
			for _, pred := range preds {
				if pred != prev {
					pred.Unlock()
				}
				prev = pred
			}
			prev = nil
		} else {
			// Node is valid, remove from skip list
			level := topLevel
			// Update all predecessors
			for level >= 0 {
				preds[level].next[level].Store(remove.next[level].Load())
				level--
			}
			// Unlock node to be removed and predecessors
			remove.Unlock()
			prev = nil
			for _, pred := range preds {
				if pred != prev {
					pred.Unlock()
				}
				prev = pred
			}
			return remove, true
		}
	}
}

// Returns a slice of all nodes between keys start and end. Will end prematurely
// if directed to do so by the context channel passed.
func (list *SkipList[K, V]) Query(ctx context.Context, start K, end K) ([]*Node[K, V], bool) {
	if start > end {
		return nil, false
	}
	for {
		// Get results and whether or not they are consistent
		result, done := list.queryHelper(start, end)
		if ctx != nil { // Shouldn't fail if called in put
			select {
			case <-ctx.Done():
				// ERROR: request terminated prematurely
				return nil, false
			default:
			}
		}
		if done {
			return result, true
		}
	}
}

// Helper function that performs two queries and checks them against each
// other to make sure no changes were made. Returns whether query was successful
// and if successful returns the queried slice of ndoes
func (list *SkipList[K, V]) queryHelper(start K, end K) ([]*Node[K, V], bool) {

	first := make([]*Node[K, V], 0)
	second := make([]*Node[K, V], 0)
	_, succ, _ := list.getPredSucc(start)
	key := succ[0].key
	node := succ[0]
	// Add all nodes within query to slice
	for key <= end && node != list.tail {
		first = append(first, node)
		node = node.next[0].Load()
		key = node.key
	}
	// Repeat the entire process for a second slice
	_, succ, _ = list.getPredSucc(start)
	key = succ[0].key
	node = succ[0]
	for key <= end && node != list.tail {
		second = append(second, node)
		node = node.next[0].Load()
		key = node.key
	}
	// Slices are different lengths, return false
	if len(first) != len(second) {
		return nil, false
	}

	for i := 0; i < len(first); i++ {
		if first[i].key != second[i].key || first[i].time.Load() != second[i].time.Load() {
			// Slices contain different keys or have been updated between both queries, return false
			return nil, false
		}
	}
	return first, true
}

// Randomly generates and returns a level for a new node based on
// a weighted probability
func GetLevel() int {
	level := rand.Float64()
	if level > float64(15)/float64(31) {
		return 0
	} else if level > float64(7)/float64(31) {
		return 1
	} else if level > float64(3)/float64(31) {
		return 2
	} else if level > float64(1)/float64(31) {
		return 3
	} else {
		return 4
	}
}

// Helper function that returns predecessors slice, sucessors slice, and level of found node
// if the specified key is found
func (list *SkipList[K, V]) getPredSucc(key K) ([]*Node[K, V], []*Node[K, V], int) {
	predecessors := make([]*Node[K, V], 5)
	successors := make([]*Node[K, V], 5)
	levelFound := -1
	level := list.head.topLevel
	pred := list.head
	// Loop through all levels of the skip list
	for level >= 0 {
		curr := pred.next[level].Load()
		// Iterate through the level until the key is found or passed
		for key > curr.key && curr != list.tail {
			pred = curr
			curr = curr.next[level].Load()
		}
		// Set top level
		if levelFound == -1 && key == curr.key {
			levelFound = level
		}
		// Update successors and predecessors
		predecessors[level] = pred
		successors[level] = curr
		level--
	}

	return predecessors, successors, levelFound
}

// Instantiates the skip list passed with all default parameters
func (list *SkipList[K, V]) MakeSkipList() {
	// Instantiates tail
	list.tail = &Node[K, V]{
		topLevel: 4,
	}
	list.tail.fullyLinked.Store(true)
	// Instantiates head
	list.head = &Node[K, V]{
		topLevel: 4,
		next:     make([]atomic.Pointer[Node[K, V]], 5),
	}
	// Populate next pointers of head with tail
	for i := 0; i < 5; i++ {
		list.head.next[i].Store(list.tail)
	}
	list.head.fullyLinked.Store(true)
}

// Returns the last node of the skiplist
func (list *SkipList[K, V]) GetLastNode() *Node[K, V] {
	node := list.head
	next := node.next[0].Load()
	for next != list.tail {
		node = next
		next = next.next[0].Load()
	}
	return node
}

// Returns the head node of the skip list
func (list *SkipList[K, V]) GetHeadNode() *Node[K, V] {
	return list.head
}

// Used for testing, created a new simple node with parameters passed
func (list *SkipList[K, V]) NewNode(key K, next *Node[K, V], top int) *Node[K, V] {
	node := Node[K, V]{
		key:      key,
		next:     make([]atomic.Pointer[Node[K, V]], 1),
		topLevel: top,
	}
	node.next[0].Store(next)
	node.fullyLinked.Store(true)
	return &node
}
