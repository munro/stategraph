build:
	@npm install -d
	@echo "/* stategraph v0.2.0 https://github.com/munro/stategraph | https://github.com/munro/stategraph/blob/master/LICENSE */" > stategraph.min.js
	@./node_modules/.bin/uglifyjs -nc stategraph.js >> stategraph.min.js
	@echo -n "Development:        " && cat stategraph.js | wc -c
	@echo -n "Production:         " && cat stategraph.min.js | wc -c
	@echo -n "Production+gzipped: " && cat stategraph.min.js | gzip -c -f | wc -c
