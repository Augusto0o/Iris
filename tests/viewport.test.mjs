import test from 'node:test';
import assert from 'node:assert/strict';
import {viewportExtent,bottomClearance} from '../src/viewport.js';
const sample={visible:812,layout:812,width:402,screenWidth:402,screenHeight:874,top:62,standalone:true,keyboard:false};
test('iPhone screenshot: keep controls inside the drawable standalone viewport',()=>assert.equal(viewportExtent(sample),812));
test('Do not extend browser, keyboard, zoomed or already complete viewports',()=>{
 for(const patch of [{standalone:false},{keyboard:true},{scale:1.5},{screenWidth:900},{screenHeight:812},{top:0}])assert.equal(viewportExtent({...sample,...patch}),812);
 assert.equal(viewportExtent({...sample,visible:874,layout:874}),874);
});

test('Standalone never extends content beyond the drawable area',()=>{
 assert.equal(viewportExtent({...sample,large:874}),812);
 assert.equal(viewportExtent({...sample,large:874,keyboard:true,visible:460}),460);
 assert.equal(viewportExtent({...sample,large:874,top:0}),812);
 assert.equal(viewportExtent({...sample,large:874,standalone:false}),812);
});

const phone={inset:34,layout:812,width:402,screenWidth:402,screenHeight:874,standalone:true,keyboard:false};
test('Short standalone viewport: the system strip already clears the home indicator',()=>assert.equal(bottomClearance(phone),0));
test('Full-height standalone viewport keeps the full home-indicator inset',()=>assert.equal(bottomClearance({...phone,layout:874}),34));
test('Browser tabs, keyboard and windowed apps are not treated as the iOS strip',()=>{
 assert.equal(bottomClearance({...phone,standalone:false}),34);
 assert.equal(bottomClearance({...phone,keyboard:true}),0);
 assert.equal(bottomClearance({...phone,layout:600}),34);
 assert.equal(bottomClearance({...phone,inset:0,layout:874}),0);
});
test('Landscape compares against the short screen side',()=>assert.equal(bottomClearance({...phone,inset:21,layout:402,width:874}),21));
