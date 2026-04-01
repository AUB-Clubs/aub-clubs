# ---- Build stage ----
FROM golang:1.25-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /server .

# ---- Runtime stage ----
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /server /server

# HACK: JIRA raised. Package defaults to loading dictionary in module because we call rword.New(). If we need this package for
# a random word, we need to organise NewWithDict() and point to the file which is either embedded or deployed independently. The
# above is going to break with the first update to the module.
COPY --from=build /go/pkg/mod/github.com/kpechenenko/rword@v0.0.4/data/dict /go/pkg/mod/github.com/kpechenenko/rword@v0.0.4/data/dict

USER nonroot:nonroot

EXPOSE 10100

ENTRYPOINT ["/server"]
