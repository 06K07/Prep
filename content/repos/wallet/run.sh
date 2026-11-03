#!/bin/bash
set -e
mkdir -p build
g++ -std=${STD:-c++17} test.cpp -o build/t
./build/t
