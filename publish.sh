#!/bin/bash

JEKYLL_ENV=production bundle exec jekyll build
# scp -r _site/* ogi@lux:/var/www/html/blog
rsync -avz -e ssh _site/ ogi@lux:/var/www/html/blog
