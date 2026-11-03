cmake_minimum_required(VERSION 3.16)
project(url_shortener LANGUAGES CXX)

if(NOT DEFINED CMAKE_CXX_STANDARD)
  set(CMAKE_CXX_STANDARD 17)
endif()
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Threads REQUIRED)

# --- library -----------------------------------------------------------------
add_library(shortener STATIC
  src/base62.cpp
  src/validator.cpp
  src/store.cpp
  src/service.cpp
)
target_include_directories(shortener PUBLIC include)
target_compile_options(shortener PRIVATE -Wall -Wextra)
target_link_libraries(shortener PUBLIC Threads::Threads)

# --- tests -------------------------------------------------------------------
add_executable(shortener_tests
  tests/main.cpp
  tests/test_base62.cpp
  tests/test_validator.cpp
  tests/test_store.cpp
  tests/test_service.cpp
)
target_link_libraries(shortener_tests PRIVATE shortener)

enable_testing()
add_test(NAME shortener_tests COMMAND shortener_tests)
