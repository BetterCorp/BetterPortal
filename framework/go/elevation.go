package protocol

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// ElevationRequirement is additional assurance, never a substitute for permissions.
type ElevationRequirement struct {
	Minimum       string `json:"minimum"`
	MaxAgeSeconds *int64 `json:"maxAgeSeconds,omitempty"`
}
type ElevationClaims struct {
	Assurance  string `json:"assurance"`
	VerifiedAt int64  `json:"verifiedAt"`
	ExpiresAt  int64  `json:"expiresAt"`
}

// VerifiedAccess must come from the host's JWT verifier and app-scope check.
// This protocol package does not implement JWT verification or a route server.
type VerifiedAccess struct {
	TenantID  string
	AppID     string
	TokenType string
	ExpiresAt int64
	Elevation *ElevationClaims
}
type ElevationRequired struct{ Headers http.Header }

func (e *ElevationRequired) Error() string { return "insufficient_user_authentication" }
func (e *ElevationRequired) Status() int   { return http.StatusUnauthorized }

// RequireElevation fails closed. Call after authentication and permissions, before effects.
func RequireElevation(user *VerifiedAccess, requirement ElevationRequirement, now time.Time) error {
	if requirement.Minimum != "confirm" && requirement.Minimum != "mfa" || requirement.MaxAgeSeconds != nil && *requirement.MaxAgeSeconds < 1 {
		return errors.New("invalid elevation requirement")
	}
	if user == nil || user.TenantID == "" || user.AppID == "" || user.TokenType != "access" || user.ExpiresAt <= now.Unix() {
		return errors.New("verified human authentication required")
	}
	e := user.Elevation
	if e != nil && (e.Assurance == "confirmed" || e.Assurance == "mfa") && e.VerifiedAt >= 0 && e.VerifiedAt <= now.Unix() && now.Unix() < e.ExpiresAt && e.ExpiresAt <= user.ExpiresAt && (requirement.Minimum != "mfa" || e.Assurance == "mfa") && (requirement.MaxAgeSeconds == nil || now.Unix()-e.VerifiedAt <= *requirement.MaxAgeSeconds) {
		return nil
	}
	challenge := map[string]any{"version": 1, "tenantId": user.TenantID, "appId": user.AppID, "minimum": requirement.Minimum}
	acr := "confirmed"
	if requirement.Minimum == "mfa" {
		acr = "mfa"
	}
	authenticate := fmt.Sprintf(`Bearer error="insufficient_user_authentication", acr_values="urn:betterportal:%s"`, acr)
	if requirement.MaxAgeSeconds != nil {
		challenge["maxAgeSeconds"] = *requirement.MaxAgeSeconds
		authenticate += fmt.Sprintf(`, max_age="%d"`, *requirement.MaxAgeSeconds)
	}
	encoded, err := json.Marshal(challenge)
	if err != nil {
		return err
	}
	headers := http.Header{}
	headers.Set("WWW-Authenticate", authenticate)
	headers.Set("BP-Auth-Challenge", string(encoded))
	headers.Set("Cache-Control", "no-store")
	return &ElevationRequired{Headers: headers}
}
