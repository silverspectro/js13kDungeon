const gulp = require('gulp');
const uglify = require('gulp-uglify');
const htmlmin = require('gulp-htmlmin');
const cssmin = require('gulp-cssmin');
const concat = require('gulp-concat');
const nodemon = require('gulp-nodemon');
const zip = require('gulp-zip');
const fs = require('fs');
const chalk = require('chalk');
const watch = require('gulp-watch');

//Chalk colors
const error = chalk.bold.red;
const success = chalk.green;
const regular = chalk.white;

const destination = './public';

gulp.task('dev', function () {
  nodemon({
		script: 'index.js', 
		watch: 'public',
		env: { 'NODE_ENV': 'development' },
  });
});

gulp.task('build-js', (done) => {
	return gulp.src(['./src/public/server.js', './src/public/client.js', './src/public/shared.js'])
	.pipe(uglify())
	.pipe(gulp.dest(destination));
});

gulp.task('build-css', (done) => {
	return gulp.src('./src/public/*.css')
		.pipe(cssmin())
		.pipe(gulp.dest('./public/'));
});

gulp.task('build-html', (done) => {
	return gulp.src('./src/public/index.html')
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(gulp.dest(destination));
});

gulp.task('zip', (done) => {
	return gulp.src('./public/*')
		.pipe(zip('entry.zip')) //gulp-zip performs compression by default
		.pipe(gulp.dest('build'));
});

gulp.task('check', gulp.series('zip', (done) => {
	const stats = fs.statSync("./build/entry.zip")
	const fileSize = stats.size;
	if (fileSize > 13312) {
		console.log(error("Your zip compressed game is larger than 13kb (13312 bytes)!"))
		console.log(regular("Your zip compressed game is " + fileSize + " bytes"));
	} else {
		console.log(success("Your zip compressed game is " + fileSize + " bytes."));
	}
	done();
}));

gulp.task('build', gulp.series('build-html', 'build-js', 'build-css', 'check', (done) => {
	done();
}));

gulp.task('watch', (done) => {
	gulp.watch('./src/public/*.js', gulp.series('build-js', 'zip', 'check'));
	gulp.watch('./src/public/*.html', gulp.series('build-html', 'check'));
	gulp.watch('./src/public/*.css', gulp.series('build-css', 'check'));
});