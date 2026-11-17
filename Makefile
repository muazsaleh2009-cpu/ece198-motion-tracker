.PHONY: help setup test test-py test-web web build samples catalog check
help:
	@echo "make setup    install python + web dependencies"
	@echo "make test     run every test (python, web analytics, web features)"
	@echo "make web      start the website on http://localhost:5173"
	@echo "make samples  regenerate demo plan, sessions and expected_stats.json"
	@echo "make catalog  re-export the exercise catalog to the website"
	@echo "make check    samples + catalog + test (what CI runs)"

setup:
	pip install -r requirements-dev.txt
	cd web && npm install

test: test-py test-web
test-py:
	python -m pytest -q
test-web:
	cd web && npm test
web:
	cd web && npm run dev
build:
	cd web && npm run build

samples:
	rm -f samples/sessions/*.json
	python tools/simulate.py
	python tools/expected_stats.py samples samples/expected_stats.json --today 2026-11-15
catalog:
	python tools/export_catalog.py web/src/data/exerciseCatalog.json
check: samples catalog test
