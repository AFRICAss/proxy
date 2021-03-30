var rw_bundle = this && arguments.callee.caller.caller,
	cookies = require('sys-nodehttp/cookies');

var _rewriter = class extends require('./index.js') {
	hook_frame(node){
		if(!node.src)node.contentWindow.rw_bundle = rw_bundle, new node.contentWindow.Function('(' + rw_bundle + ')()')();
	}
	exec_globals(){
		if(typeof $rw_get == 'undefined'){
			var rewriter = this,
				Location = global.WorkerLocation || global.Location,
				location = global.location,
				Proxy = global.Proxy,
				URL = global.URL,
				// first argument is thisArg since call is binded
				toString = (_=>_).call.bind([].toString),
				toStringFunc = (_=>_).call.bind((_=>_).toString),
				defineProperty = Object.defineProperty,
				defineProperties = Object.defineProperties,
				getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor,
				getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors,
				getOwnPropertyNames = Object.getOwnPropertyNames,
				getPrototypeOf = Object.getPrototypeOf,
				setPrototypeOf = Object.setPrototypeOf,
				hasOwnProperty = Object.hasOwnProperty,
				fromEntries = Object.fromEntries,
				fetch = global.fetch,
				keys = Object.keys,
				meta = () => ({
					origin: location.origin,
					base: rewriter.unurl(location.href, this.empty_meta),
				}),
				rw_exposed_cookies = {},
				wrapped_locations = new Map(),
				wrapped_location = original => {
					var unproxied = new URL('http:a'),
						location = setPrototypeOf({}, null);
					
					if(original.reload)location.reload = original.reload;
					if(original.replace)location.replace = url => original.replace(this.url(new URL(url, meta().base).href, meta(), { route: 'html' }));
					if(original.assign)location.assign = url => original.assign(this.url(new URL(url, meta().base).href, meta(), { route: 'html' }));
					
					defineProperties(location, fromEntries(keys(getPrototypeOf(original)).concat(keys(original)).filter(prop => !hasOwnProperty.call(location, prop)).map(prop => [ prop, {
						get(){
							unproxied.href = rewriter.unurl(original.href, meta());
							
							var ret = Reflect.get(unproxied, prop);
							
							return typeof ret == 'function' ? Object.defineProperties(ret.bind(unproxied), Object.getOwnPropertyDescriptors(ret)) : ret;
						},
						set(value){
							unproxied.href = rewriter.unurl(original.href, meta());
							
							var ret = Reflect.set(unproxied, prop, value);
							
							original.href = rewriter.url(unproxied.href, meta(), { route: 'html' });
							
							return ret;
						},
					} ])));
					
					wrapped_locations.set(original, location);
					
					return location;
				},
				rw_proxy = object => {
					var proto = object != null && typeof object == 'object' && getPrototypeOf(object);
					
					if(proto && ['[object Location]', '[object WorkerLocation]'].includes(toString(proto)))return wrapped_locations.get(object) || wrapped_location(object);
					return object;
				},
				bind_proxy = (obj, func, prox) => (prox = new Proxy(func, {
					construct(target, args){
						return Reflect.construct(target, args);
					},
					apply(target, that, args){
						return Reflect.apply(target, that == prox ? obj : that, args);
					},
					get(target, prop){
						var ret = Reflect.get(target, prop);
						
						return typeof ret == 'function' ? bind_proxy(func, ret) : ret;
					},
					set(target, prop, value){
						return Reflect.set(target, prop, value);
					},
				})),
				rw_global_eval = script => eval(rw_eval(script)),
				rw_url = url => this.url(url, meta()),
				rw_get = (object, property, bound) => {
					var ret = object[property];
					
					// rw_get(parent, 'eval') 😶
					if(typeof ret == 'function' && ret.name == 'eval' && object == global)ret = rw_global_eval;
					
					var out = rw_proxy(ret);
					
					// USE PROXY INSTEAD OF BINDING, NEW PROPERTIES SET WILL NOT BE ON ORIGINAL
					if(typeof out == 'function' && bound)out = bind_proxy(object, out);
					
					return out;
				},
				rw_set = (object, property) => {
					return {
						set val(value){
							var target = Reflect.get(object, property);
							
							if(target instanceof Location)return rw_proxy(target).href = value;
							
							return Reflect.set(object, property, value);
						},
					};
				},
				rw_eval = script => {
					return this.js(script, meta(), { inline: true });
				},
				rw_Response = class extends Response {
					get url(){
						return rewriter.unurl(super.url, meta());
					}
				},
				rw_func = (construct, args) => {
					var decoy = construct(args),
						script = args.splice(-1)[0],
						proxied = construct([ ...args, 'return(' + this.js('()=>{' + script + '\n}', meta(), { inline: true }).slice(0, -1) + ')()' ]);
					
					defineProperty(proxied, 'length', { get: _ => decoy.length, set: _ => _ });
					proxied.toString = Function.prototype.toString.bind(decoy);
					
					return proxied;
				};
			
			this.createObjectURL = URL.createObjectURL;
			this.revokeObjectURL = URL.revokeObjectURL;
			
			global.$rw_get = rw_get;
			global.$rw_get_global = (property, bound) => rw_get(global, property, bound);
			global.$rw_set = rw_set;
			global.$rw_proxy = rw_proxy;
			global.$rw_eval = rw_eval;
			global.$rw_url = rw_url;
			
			if(global.URL){
				if(global.URL.createObjectURL)global.URL.createObjectURL = new Proxy(global.URL.createObjectURL, {
					apply: (target, that, [ source ]) => {
						var url = Reflect.apply(target, that, [ source ]);
						
						this.blobs.set(url, this.blobs.get(source));
						
						return url;
					},
				});
				
				if(global.URL.revokeObjectURL)global.URL.revokeObjectURL = new Proxy(global.URL.revokeObjectURL, {
					apply: (target, that, [ url ]) => {
						var ret = Reflect.apply(target, that, [ url ]);
						
						this.blobs.delete(url);
						
						return ret;
					},
				});
			}
			
			if(global.Blob)global.Blob = global.Blob.prototype.constructor = new Proxy(global.Blob, {
				construct: (target, [ data, opts ]) => {
					var blob = Reflect.construct(target, [ data, opts ]);
					
					this.blobs.set(blob, data);
					
					return blob;
				},
			});
			
			if(global.Navigator)global.Navigator.prototype.sendBeacon = new Proxy(global.Navigator.prototype.sendBeacon, {
				apply: (target, that, [ url, data ]) => Reflect.apply(target, that, [ this.url(new URL(url, location).href, meta(), data) ]),
			});
			
			if(global.Function)global.Function =global.Function.prototype.constructor = new Proxy(global.Function, {
				apply: (target, that, args) => rw_func(args => Reflect.apply(target, that, args), args),
				construct: (target, args) => rw_func(args => Reflect.construct(target, args), args),
			});
			
			if(global.importScripts)global.importScripts = new Proxy(global.importScripts, {
				apply: (target, that, scripts) => Reflect.apply(target, that, scripts.map(script => this.url(new URL(url, location).href, meta(), { route: 'js' }))),
			});
			
			if(global.Worker)global.Worker = global.Worker.prototype.constructor = new Proxy(global.Worker, {
				construct: (target, [ url ]) => Reflect.construct(target, [ this.url(new URL(url, location).href, meta(), { route: 'js' }) ]),
			});
			
			if(global.fetch)global.fetch = new Proxy(global.fetch, {
				apply: (target, that, [ url, opts ]) => new Promise((resolve, reject) => Reflect.apply(target, that, [ this.url(url, meta()), opts ]).then(res => resolve(setPrototypeOf(res, rw_Response.prototype))).catch(reject)),
			});
			
			if(global.XMLHttpRequest)global.XMLHttpRequest = class extends global.XMLHttpRequest {
				open(method, url, ...args){
					return super.open(method, rewriter.url(new URL(url, location).href, meta()), ...args);
				}
				get responseURL(){
					return rewriter.unurl(super.responseURL, meta());
				}
			};
			
			if(global.History)global.History.prototype.pushState = new Proxy(global.History.prototype.pushState, {
				apply: (target, that, [ state, title, url = '' ]) => Reflect.apply(target, that, [ state, this.config.title, this.url(url, meta(), { route: 'html' }) ]),
			}), global.History.prototype.replaceState = new Proxy(global.History.prototype.replaceState, {
				apply: (target, that, [ state, title, url = '' ]) => Reflect.apply(target, that, [ state, this.config.title, this.url(url, meta(), { route: 'html' }) ]),
			});
			
			if(global.WebSocket)global.WebSocket = class extends global.WebSocket {
				constructor(url, proto){
					super(rewriter.url(new URL(url, location).href, meta(), { ws: true }), proto);
					
					var open;
					
					this.addEventListener('open', event => event.stopImmediatePropagation(), { once: true });
					// first packet is always `open`
					this.addEventListener('message', event => (event.stopImmediatePropagation(), this.dispatchEvent(new Event('open'))), { once: true });
				}
			};
			
			if(global.Storage){
				var sync = Symbol(),
					get_item = global.Storage.prototype.getItem,
					set_item = global.Storage.prototype.setItem,
					sync_sandbox = function(obj = this){
						set_item.call(storage, get_sandbox_host(), obj);
					},
					get_sandbox_host = () => new URL(meta().base).hostname,
					get_sandbox = storage => {
						var sandbox = setPrototypeOf(JSON.parse(get_item.call(storage, get_sandbox_host()) || '{}'), null);
						
						sandbox[sync] = sync_sandbox;
						
						return sandbox;
					};
				
				Object.defineProperty(global.Storage.prototype, 'length', {
					get(){
						return keys(get_sandbox(this)).length;
					},
				});
				
				global.Storage.prototype.key = function(ind){
					return keys(get_sandbox(this))[ind];
				};
				
				global.Storage.prototype.clear = function(){
					sandbox[sync]({});
				};
				
				global.Storage.prototype.removeItem = function(item){
					var sandbox = get_sandbox(this);
					
					delete sandbox[item];
					
					sandbox[sync]();
				};
				
				global.Storage.prototype.hasOwnProperty = function(item){
					return typeof get_sandbox(this)[item] != 'undefined';
				};
				
				global.Storage.prototype.getItem = function(item){
					return get_sandbox(this)[item];
				};
				
				global.Storage.prototype.setItem = function(item, value){
					var sandbox = get_sandbox(this);
					
					sandbox[item] = toString(value);
					
					sandbox[sync]();
				};
				
				if(global.localStorage)defineProperties(global, fromEntries(['localStorage', 'sessionStorage'].map((storage, prox, targ) => (prox = new Proxy(targ, {
					get: (target, prop, ret) => typeof (ret = Reflect.get(target, prop)) == 'string' ? get_sandbox(target)[item] : typeof ret == 'function' ? bind_proxy(target, ret) : ret,
					set: (target, prop, value) => {
						var proto = getPrototypeOf(target);
						
						return target.hasOwnProperty(prop) ? Reflect.set(target, prop, value) : proto.setItem.call(target, prop);
					},
				}), [ storage, {
					get: _ => prox,
					configurable: true,
					enumerable: true,
				} ]))));
			}
			
			// dom context
			if(global.Node){
				var getAttribute = global.Element.prototype.getAttribute,
					setAttribute = global.Element.prototype.setAttribute;
				
				new global.MutationObserver(mutations => [...mutations].forEach(mutation => {
					[...mutation.addedNodes].forEach(node => node.tagName == 'IFRAME' && this.hook_frame(node));
					if(mutation.target.tagName == 'IFRAME')this.hook_frame(mutation.target);
				})).observe(document, { childList: true, attributes: true, subtree: true });
				
				global.Element.prototype.getAttribute = new Proxy(global.Element.prototype.getAttribute, {
					apply: (target, that, [ attr ]) => {
						var value = Reflect.apply(target, that, [ attr ]),
							data = this.attribute({ // get precise type info without modifying
								tagName: that.tagName,
								getAttribute: getAttribute.bind(that),
								getAttributeNames: that.getAttributeNames.bind(that),
							}, attr, value, meta(), false);
						
						return data.value && this['un' + data.type] ? this['un' + data.type](data.value, meta()) : value;
					},
				});
				
				global.Element.prototype.setAttribute = new Proxy(global.Element.prototype.setAttribute, {
					apply: (target, that, [ attr, value ]) => {
						var data = this.attribute(that, attr, value, meta());
						
						if(data.preserve_source)setAttribute.call(that, data.name + '-rw', value);
						
						if(data.deleted)return that.removeAttribute(attr);
						
						data.modify.forEach(attr => Reflect.apply(target, that, [ attr.name, attr.value ]));
						
						return Reflect.apply(target, that, [ data.name, data.value ]);
					},
				});
				
				var script_handler = desc => ({
						get(){
							return rewriter.unjs(desc.get.call(this) || '', meta());
						},
						set(value){
							return desc.set.call(this, rewriter.js(value || '', meta()));
						},
					}),
					style_handler = desc => ({
						get(){
							return rewriter.uncss(desc.get.call(this) || '', meta());
						},
						set(value){
							return desc.set.call(this, rewriter.css(value || '', meta()));
						},
					});
				
				defineProperties(global.HTMLScriptElement.prototype, {
					text: script_handler(getOwnPropertyDescriptor(global.HTMLScriptElement.prototype, 'text')),
					innerHTML: script_handler(getOwnPropertyDescriptor(global.Element.prototype, 'innerHTML')),
					innerText: script_handler(getOwnPropertyDescriptor(global.HTMLElement.prototype, 'innerText')),
					outerText: style_handler(getOwnPropertyDescriptor(global.HTMLElement.prototype, 'innerText')),
					textContent: script_handler(getOwnPropertyDescriptor(global.Node.prototype, 'textContent')),
				});
				
				defineProperties(global.HTMLStyleElement.prototype, {
					innerHTML: style_handler(getOwnPropertyDescriptor(global.Element.prototype, 'innerHTML')),
					innerText: style_handler(getOwnPropertyDescriptor(global.HTMLElement.prototype, 'innerText')),
					outerText: style_handler(getOwnPropertyDescriptor(global.HTMLElement.prototype, 'innerText')),
					textContent: style_handler(getOwnPropertyDescriptor(global.Node.prototype, 'textContent')),
				});
				
				var html_handler = desc => ({
					get(){
						return rewriter.unhtml(desc.get.call(this) || '', meta(), { snippet: true });
					},
					set(value){
						return desc.set.call(this, rewriter.html(value || '', meta(), { snippet: true }));
					},
				});
				
				defineProperties(global.Element.prototype, {
					innerHTML: html_handler(getOwnPropertyDescriptor(global.Element.prototype, 'innerHTML')),
					outerHTML: html_handler(getOwnPropertyDescriptor(global.Element.prototype, 'outerHTML')),
				});
				
				var titles = new Map(),
					title = getOwnPropertyDescriptor(global.Document.prototype, 'title').get;
				
				defineProperties(global.Document.prototype, {
					title: {
						get(){
							if(!titles.has(this))titles.set(this, title.call(this));
							
							return titles.get(this);
						},
						set(value){
							return titles.set(this, value);
						},
					},
					cookie: {
						get(){
							return cookies.format_object(rw_exposed_cookies);
						},
						set: value => {
							fetch(this.config.prefix + '/cookie', {
								headers: {
									'content-type': 'application/json',
								},
								method: 'POST',
								body: JSON.stringify({
									url: new URL(meta().base).href,
									value: value,
								}),
							});
							
							return cookies.format_object(Object.assign(rw_exposed_cookies, cookies.parse_object(value, true)));
						},
					},
				});
				
				this.attr.inherits_url.forEach(prop => {
					if(!global[prop])return;
					
					var proto = global[prop].prototype,
						descs = getOwnPropertyDescriptors(proto);
					
					this.attr.url[1].forEach(attr => descs.hasOwnProperty(attr) && defineProperty(proto, attr, {
						get(){
							return this.getAttribute(attr);
						},
						set(value){
							return this.setAttribute(attr, value);
						},
					}));
					
					this.attr.del[1].forEach((attr, set_val) => (set_val = new Map()) && descs.hasOwnProperty(attr) && defineProperty(proto, attr, {
						get(){
							return set_val.has(this) ? set_val.get(this) : (set_val.set(this, getAttribute.call(this, attr)), set_val.get(this))
						},
						set(value){
							set_val.set(this, value);
							
							return value;
						},
					}));
				});
				
				defineProperties(global.HTMLAnchorElement.prototype, fromEntries(['origin', 'protocol', 'username', 'password', 'host', 'hostname', 'port', 'pathname', 'search', 'hash'].map(attr => [ attr, {
					get(){
						return new URL(this.getAttribute('href'), meta().base)[attr];
					},
					set(value){
						var curr = new URL(this.getAttribute('href'));
						
						curr[attr] = value;
						
						this.setAttribute('href', curr.ref);
						
						return value;
					},
				} ])));
				
				global.postMessage = new Proxy(global.postMessage, {
					apply: (target, that, [ data, origin, transfer ]) => Reflect.apply(target, that, [ JSON.stringify([ 'proxy', data, origin ]), location.origin, transfer ]),
				});
				
				global.addEventListener('message', event => {
					var data;
					
					try{
						data = JSON.parse(event.data);
					}catch(err){}
					
					if(!data || data[0] != 'proxy')return;
					
					defineProperties(event, {
						data: { get: _ => data[1], set: _ => _ },
						origin: { get: _ => data[2], set: _ => _ },
					});
				});
				
				delete global.navigator.getUserMedia;
				delete global.navigator.mozGetUserMedia;
				delete global.navigator.webkitGetUserMedia;
				delete global.MediaStreamTrack;
				delete global.mozMediaStreamTrack;
				delete global.webkitMediaStreamTrack;
				delete global.RTCPeerConnection;
				delete global.mozRTCPeerConnection;
				delete global.webkitRTCPeerConnection;
				delete global.RTCSessionDescription;
				delete global.mozRTCSessionDescription;
				delete global.webkitRTCSessionDescription;
			}
		}
	}
};

var rewriter = new _rewriter(inject_config);

rewriter.bundle_ts = inject_bundle_ts;

rewriter.exec_globals();