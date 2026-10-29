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
 assert.equal(viewportExtent({...sample,large:874,keyboard:true,visible:460}),812); // keyboard: keep the full height, iOS pans
 assert.equal(viewportExtent({...sample,large:874,top:0}),812);
 assert.equal(viewportExtent({...sample,large:874,standalone:false}),812);
});

const phone={inset:34,top:62,layout:812,width:402,screenWidth:402,screenHeight:874,standalone:true,keyboard:false};
test('Short standalone viewport: the system strip already clears the home indicator',()=>assert.equal(bottomClearance(phone),0));
test('Full-height standalone viewport keeps the full home-indicator inset',()=>assert.equal(bottomClearance({...phone,layout:874}),34));
test('Browser tabs, keyboard and windowed apps are not treated as the iOS strip',()=>{
 assert.equal(bottomClearance({...phone,standalone:false}),34);
 assert.equal(bottomClearance({...phone,keyboard:true}),0);
 assert.equal(bottomClearance({...phone,layout:600}),34);
 assert.equal(bottomClearance({...phone,inset:0,layout:874}),0);
});
test('Landscape compares against the short screen side',()=>assert.equal(bottomClearance({...phone,inset:21,layout:402,width:874}),21));
test('Short visual viewport counts even when innerHeight reports the full screen',()=>{
 assert.equal(bottomClearance({...phone,layout:874,visible:812}),0);
 assert.equal(bottomClearance({...phone,layout:874,visible:874}),34);
});
test('Opaque status bar: page starts below it and keeps the full home-indicator inset',()=>assert.equal(bottomClearance({...phone,top:0,layout:812,visible:812}),34));
test('Opaque status bar with a 0 reported inset still clears the home indicator on Face ID iPhones',()=>{
 assert.equal(bottomClearance({...phone,inset:0,top:0,homeIndicator:34}),34);
 assert.equal(bottomClearance({...phone,inset:0,top:0,homeIndicator:0}),0);
 assert.equal(bottomClearance({...phone,inset:0,top:62,homeIndicator:34}),0); // the system strip below already clears it
 assert.equal(bottomClearance({...phone,inset:0,top:0,homeIndicator:34,standalone:false}),0);
});
