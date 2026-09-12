package protocol

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestSharedElevationCases(t *testing.T) {
	data, err := os.ReadFile("testdata/elevation-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name        string               `json:"name"`
		Now         int64                `json:"now"`
		Allowed     bool                 `json:"allowed"`
		Requirement ElevationRequirement `json:"requirement"`
		User        struct {
			TenantID  string           `json:"tenantId"`
			AppID     string           `json:"appId"`
			TokenType string           `json:"tokenType"`
			Exp       int64            `json:"exp"`
			Elevation *ElevationClaims `json:"elevation"`
		} `json:"user"`
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			user := VerifiedAccess{TenantID: c.User.TenantID, AppID: c.User.AppID, TokenType: c.User.TokenType, ExpiresAt: c.User.Exp, Elevation: c.User.Elevation}
			err := RequireElevation(&user, c.Requirement, time.Unix(c.Now, 0))
			if (err == nil) != c.Allowed {
				t.Fatalf("allowed=%v error=%v", c.Allowed, err)
			}
		})
	}
}
