# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

all:
	make bundle
	make server &
	make watch_build

postinstall:
	npm dedup
	make bundle

bundle:
	./node_modules/.bin/browserify assets/index.js > bundle.js

watch_build:
	./node_modules/.bin/wr "make bundle" ./assets/*.js

server:
	./bin/server .

