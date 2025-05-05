# k6 TypeScript Load Testing

This directory contains k6 load test scripts written in TypeScript for the chat application.

## Directory Structure

- `scripts-ts/`: TypeScript test scripts
- `scripts/`: Original JavaScript test scripts
- `dist/`: Compiled JavaScript output (generated)
- `grafana/`: Grafana configuration for visualization
- `results/`: Test results and logs

## Running Tests

### With Docker & TypeScript (Recommended)

```bash
# Run minimal test (7s duration, 2 VUs)
./run-test.sh --minimal

# Run simple test (10s duration, 10 VUs)
./run-test.sh --simple

# Run with custom parameters
./run-test.sh --minimal --duration=15s --vus=5
```

### Without TypeScript

```bash
# Use plain JavaScript versions
./run-test.sh --minimal --no-ts
```

### Locally (requires k6 installation)

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run test
pnpm test:minimal
```

## Development

1. Write TypeScript test scripts in the `scripts-ts/` directory
2. Build with `pnpm build`
3. Tests will be compiled to the `dist/` directory
4. Run with k6 directly or via docker-compose

## Environment Variables

- `API_HOST`: Target API host (default: nginx)
- `API_PORT`: Target API port (default: 5002)
- `K6_DURATION`: Test duration (default: varies by test type)
- `K6_VUS`: Number of virtual users (default: varies by test type)

## Grafana Dashboard

Access the Grafana dashboard at: http://localhost:3001 