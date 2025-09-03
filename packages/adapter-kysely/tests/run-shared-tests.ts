import { runSharedAdapterTests } from "@vorsteh-queue/adapter-tests/src/sharedAdapterTests"

import { createKyselyAdapter } from "../src/createAdapter"

runSharedAdapterTests(createKyselyAdapter)
