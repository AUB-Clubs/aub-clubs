//go:generate go run github.com/99designs/gqlgen generate
package graph

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

import (
	"database/sql"
	"fmt"
	_ "github.com/lib/pq"
)

type Resolver struct{
	aiIdeDB     *sql.DB 
}

func NewResolver(aiIdeDB *sql.DB) *Resolver {
	return &Resolver{
		aiIdeDB:     aiIdeDB,
	}
}

func ConnectAIIDEDatabase(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}