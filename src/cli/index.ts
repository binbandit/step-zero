#!/usr/bin/env node

import { Command } from "commander";
import { reviewCommand } from "./commands/review";
import { statusCommand } from "./commands/status";
import { configCommand } from "./commands/config";

const program = new Command();

program
  .name("step-zero")
  .description("Step Zero — Pre-PR review layer for AI-generated code")
  .version("0.1.0");

program.addCommand(reviewCommand);
program.addCommand(statusCommand);
program.addCommand(configCommand);

program.parse();
