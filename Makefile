PYTHON ?= python3

.PHONY: change-add change-build

change-add:
	@$(PYTHON) scripts/change_add.py $(ARGS)

change-build:
	@$(PYTHON) scripts/change_build.py
