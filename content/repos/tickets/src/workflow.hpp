#pragma once
#include "models.hpp"

inline bool canTransition(Status from, Status to) {
    switch (from) {
        case Status::OPEN:        return to == Status::IN_PROGRESS;
        case Status::IN_PROGRESS: return to == Status::RESOLVED || to == Status::OPEN;
        case Status::RESOLVED:    return to == Status::CLOSED;
        case Status::CLOSED:      return true;
    }
    return false;
}
