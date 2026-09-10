package main

import (
	"fmt"
	protocol "github.com/BetterCorp/BetterPortal/framework/go"
	"log"
)

func main() {
	representation, err := protocol.Negotiate("text/html;mode=fragment,application/json;q=0.5", nil)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(representation.Kind + ":" + *representation.Mode)
	event := "status"
	wire, err := protocol.EncodeEvent("<span>Ready</span>", protocol.EventOptions{Event: &event})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Print(string(wire))
	var headers protocol.HeaderDirectives
	if err := headers.Remove("Authorization"); err != nil {
		log.Fatal(err)
	}
	for _, pair := range headers.Emit() {
		fmt.Println(pair.Name + ": " + pair.Value)
	}
}
