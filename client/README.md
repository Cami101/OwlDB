[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-24ddc0f5d75046c5622901739e7c5dd533143b0c8e959d652212380cedb1ea36.svg)](https://classroom.github.com/a/UjNonpZI)
# M3ssag1n8 Project

Messaging web client application for COMP 318, created by Nat Hill, Zoe Katz, and Cameron Liu.

## Getting stated

Install all of the required dependencies in order to build your project:

```npm install```

This will automatically install all of the tools and dependencies that are
needed and allowed for the project.  You should only need to run npm install
once each time you create a fresh clone.

You should *not* use `npm install` to install anything else. The packages in
`package.json` that are installed with this command are the only packages you
are allowed to use.

## Provided Resources

### src/main.ts

The provided `main.ts` file is a simple skeleton for you to start with. It
simply declares the process environment variables and prints a message to the
console (using slog).

### src/slog.ts

This is a simple structured logging package that you may use. Feel free to
modify it to suit your needs.

### html/index.html

This is a simple skeleton HTML file that should be the main page of your client.
It includes everything you need for your project and the allowed external
resources.

The only additional external resources you may include in this file are [Google
Fonts](https://fonts.google.com).

### styles/styles.css

This is an empty file where you can put your CSS.  It is already linked
from html/index.html.

## Environment Variables

You must not hardcode the database URL into your application.  Instead, you
should read the environment variables from the ".env" file to determine what
OwlDB database to use. The provided ".env" file gives an example. Feel free
to update the values (but not the environment variable names or the format)
to refer to whatever database you want to use for testing purposes.

When testing your code, we will use our own ".env" file that has exactly the
same structure as the provided file.

If you want to use different databases, you can have an ".env.local" file that
is used instead of ".env".  You should have ".env" checked into your git
repostory, but **you should not check in your ".env.local" files to git!**.

## Build

Before you build, you will need to create an empty "schemas" directory. This
will be the directory that you will eventually add your schemas to.

After you have created that directory, you can build your project as follows:

```npm run build```

This will create a file called "dist/index.html" along with the necessary
additional files.  If you open "dist/index.html" in a web browser you will see
your application.

As you develop, you may instead want to use:

```npm start```

This starts up a web server and tells you the correct URL.  If you navigate to
that URL, you will see your application.  The advantage of this method is that
it does "hot module reloading".  This means that as you edit and save your
files, they will automatically be reloaded in the web browser.  Note, however,
that this will not always work seemlessly, as you will lose some application
state, depending on what you edited. So, you still may need to hit "refresh" in
your browser.

## Testing

In order to run our tests, we're using `cypress`.

If you have already cloned the repo, make sure to `npm install`.

First, run the server with `npm run start`, then in our folder, run `cypress run`

Also, make sure the URL in the cypress file is correct (Default is http://localhost:1234),
and that the workspaces created by cypress don't already exist.

## Additional Commands

The "package.json" file defines some additional commands for you to use:

1. Type checking

To type check your project, run:

```npm run check```

This runs TypeScript over every ".ts" file in your "src" directory.  You should
do this often.  Note that VSCode also continuously type checks your code as you
work.

2. Formatting

To format your code, run:

```npm run format```

This will use "prettier" to reformat your code to conform to the required style
for the project. Again, you should do this often, preferably before every commit
to git.

3. Documentation

To produce documentation from your code, run:

```npm run doc```

This will run TypeDoc to produce documentation that you should ultimately commit
to your git repository.

4. Testing

Tou should write tests in files with names that end in ".test.ts" that you store
in a directory named "tests". To run these tests, run:

```npm run test```

This will run every test in test files in the "tests" directory.  See
the documentation for [Jest](https://jestjs.io) for more information.

5. Schemas to Types

To explicitly convert your JSON schemas in your "schemas" directory to
TypeScript type declarations, run:

```npm run schema```

This will produce files in a "types" directories with names that end in ".d.ts"
with the same base name as the JSON file in the "schemas" directory.  You can
then use these types in your TypeScript code.

Note that ```npm run build```, ```npm run check```, ```npm run start```, and
```npm run test``` all run this automatically, so you don't really need to every
run this explicitly except when you are developing your schemas to see if they
convert correctly.
