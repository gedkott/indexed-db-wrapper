# notes
I built this using typescript and no module system just for fun.
I wanted to try writing code as though none of the stuff (almost none)
we have today would be available. 
I used typescript to stay on top of the IndexedDB types as much as possible
to avoid misusing the browser's imlemenation in my wrapper.
This is not a well thought out wrapper. I just covered some basic territory in the implementation.
Just to see how it could be done. The result is that this wrapper is completely imperfect. 
I also took eslint along for the basics as well when it comes to linting, formatting.

# build
1. run `npm install`
2. use tsc installed in the node_modules directory to continuously compile `node node_modules\typescript\bin\tsc --watch`
3. open index.html in your browser and then open the dev tools to see the console output to see what happens with each of the mocks when they run the same user code
