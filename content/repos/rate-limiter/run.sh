#!/bin/bash
# Builds and runs the test suite.
set -e
mkdir -p build
g++ -std=${STD:-c++17} -I src tests/test.cpp -o build/tests
./build/tests
