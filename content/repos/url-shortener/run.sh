#!/bin/bash
# Configure + build with CMake, then run the test executable (prints PASS/FAIL per test).
set -e
STD_NUM=$(echo "${STD:-c++17}" | tr -dc '0-9')
case "$STD_NUM" in 11 | 14 | 17 | 20 | 23) ;; *) STD_NUM=17 ;; esac

cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug -DCMAKE_CXX_STANDARD="$STD_NUM" >build.log 2>&1 || { cat build.log; exit 1; }
cmake --build build -j2 >>build.log 2>&1 || { cat build.log; exit 1; }
./build/shortener_tests
