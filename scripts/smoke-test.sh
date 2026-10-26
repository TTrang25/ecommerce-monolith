#!/usr/bin/env bash
set -euo pipefail

BASE=${BASE:-http://localhost:3000}
set -a; source .env; set +a

JSON='Content-Type: application/json'
U="user$RANDOM"
NX="X-$RANDOM"
NY="Y-$RANDOM"

check() {
  if [ "$2" = "$3" ]; then
    echo "  OK: $1"
  else
    echo "  FAIL: $1 (expected $3, got $2)"
    exit 1
  fi
}

echo "1) health check"
curl -fsS "$BASE/health"; echo

echo "2) register -> role normal, score 10"
curl -fsS -X POST "$BASE/api/auth/register" -H "$JSON" \
  -d "{\"username\":\"$U\",\"fullname\":\"CI User\",\"password\":\"123456\"}" > /tmp/reg.json
check "role" "$(jq -r .role /tmp/reg.json)" "normal"
check "score" "$(jq -r .membership.score /tmp/reg.json)" "10"

echo "3) login -> token"
TOKEN=$(curl -fsS -X POST "$BASE/api/auth/login" -H "$JSON" \
  -d "{\"username\":\"$U\",\"password\":\"123456\"}" | jq -r .token)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && echo "  OK: got token"

echo "4) create 2 products in the database"
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "INSERT INTO \"Product\" (pname, price, quantity) VALUES ('$NX', 100, 50), ('$NY', 250.5, 20);"
P1=$(curl -fsS "$BASE/api/products" | jq -r "[.[] | select(.pname==\"$NX\")][0].pid")
P2=$(curl -fsS "$BASE/api/products" | jq -r "[.[] | select(.pname==\"$NY\")][0].pid")

echo "5) order without token -> 401"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/orders" -H "$JSON" \
  -d "{\"items\":[{\"pid\":$P1,\"qty\":2}]}")
check "status" "$CODE" "401"

echo "6) order with token -> 201, 2 details, 1 shipment"
curl -fsS -X POST "$BASE/api/orders" -H "$JSON" -H "Authorization: Bearer $TOKEN" \
  -d "{\"items\":[{\"pid\":$P1,\"qty\":2},{\"pid\":$P2,\"qty\":5}]}" > /tmp/order.json
check "details" "$(jq '.details | length' /tmp/order.json)" "2"
check "shipments" "$(jq '.shipments | length' /tmp/order.json)" "1"
check "shipment status" "$(jq -r '.shipments[0].status' /tmp/order.json)" "PENDING"

echo "7) stock decreased"
check "product 1 quantity" "$(curl -fsS "$BASE/api/products/$P1" | jq .quantity)" "48"
check "product 2 quantity" "$(curl -fsS "$BASE/api/products/$P2" | jq .quantity)" "15"

echo "8) order more than stock -> 400, stock unchanged"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/orders" -H "$JSON" \
  -H "Authorization: Bearer $TOKEN" -d "{\"items\":[{\"pid\":$P1,\"qty\":9999}]}")
check "status" "$CODE" "400"
check "product 1 quantity" "$(curl -fsS "$BASE/api/products/$P1" | jq .quantity)" "48"

echo "ALL TESTS PASSED"