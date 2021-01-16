class UI {
    /**
     * Navigation constructor.
     * @constructor
     * @param {object} obj - Object containing the settings
     * @param {string[]} obj.defaultPath - Array containing the default URL path (used if path is '/' or invalid)
     * @param {string} obj.activeClass - Class used to select the active section on the left bar (leave as undefined to disable this functionality)
     * @param {func} obj.dismissAnimation - Function called to dismiss the current UI (usually something like slide or fade out)
     * @param {func} obj.welcomeAnimation - Function called to welcome or bring the new UI (usually something like slide or fade in)
     * @param {number} obj.animationTime - Expected time for the each animation to complete (both animations should last the same)
     * @param {func} obj.drawCallback - Function called every time HTML is updated. Used to for example replace feather icons with every DOM update
     * @param {string} obj.searchInput - Id of search bar or input to use. If undefined, this option will be disabled.
     * @param {string} obj.listBarHTML - HTML used to construct the pagination used in list mode (don't specify to disable it)
     * @param {func} obj.onTitle - Function called to create the title of the site (it should receive a parameter with the path in array format and return an string)
     * @param {func} obj.onUnsaved - Function called when changed section without saving first
     * @param {func} obj.onSection - Everytime the section is changed this function is called (useful to update the nav)
     * @param {func} obj.onInvalidURL - If the URL is invalid call this method
     * @param {func} obj.onUnload - If specified, when the page closes UI calls this function
    */
    constructor(obj) {
        this.grid = document.getElementById("grid");
        this.session = Math.random();
        this.force = false;
        this.listOrder = "id";
        this.listDesc = true;
        this.listPage = 1;
        this.listBarHTML = obj.listBarHTML;
        this.defaultPath = obj.defaultPath;
        this.activeClass = obj.activeClass;
        this.dismissAnimation = obj.dismissAnimation;
        this.welcomeAnimation = obj.welcomeAnimation;
        this.animationTime = obj.animationTime;
        this.animationStart = performance.now();
        this.animationCallback = null;
        this.drawCallback = obj.drawCallback;
        this.searchInput = obj.searchInput;
        this.onTitle = obj.onTitle;
        this.onUnsaved = obj.onUnsaved;
        this.onSection = obj.onSection;
        this.onInvalidURL = obj.onInvalidURL;
        this.onUnload = obj.onUnload;

        this.state = this.defaultPath;
        this.order = 0;
        this.steps = 0;
        this.unsaved = false;
        this.lastsave = -1000;
        this.lastsee = -1000;

        /**
         * @namespace
         * @property {object}  module             - Each module has its own structure defining its properties
         * @property {string[]}  module.modules   - Array containing the name of the submodules or dependencies (only the main ones as nested dependencies will also be loaded)
         * @property {func}  module.class         - Function returning the variable containing the initialized class of the module
         * @property {string}  module.grid        - Id of the grid the module will use to draw.
         * @property {string}  module.translation - Full name of the module.
         * @property {string}  module.icon        - Name of the icon representing the module (useful for feather icons).
         * @property {func}  module.onList        - Each time list is shown call this method to update the GUI tools
         * @property {func}  module.onSee         - Each time the module is shown in see call this method to update the GUI tools
         * @property {func}  module.onAdd         - Each time the module is shown in add call this method to update the GUI tools
        */
        this.modules = {};

        window.addEventListener('popstate', this.popstate.bind(this));
        window.onbeforeunload = function () {
            if (this.onUnload != undefined) this.onUnload();
            if (this.changed()) return "";
        }.bind(this);
    }

    /**
     * Do not call! This is the callback for window 'popstate' listener.
     * @param {object} event - Event object
     * @param {object} event.state - State object
     * @param {number} event.state.order - Order of state
     * @param {string} event.state.title - Title of tab
     * @param {number} event.state.session - Random number identifying session
    */
    popstate(event) {
        var old = this.state;
        var now = this.section();

        if (this.unsaved) {
            this.unsaved = false;
            this.state = now;
            this.order = event.state.order;
            document.title = event.state.title;
            this.force = false;
            return;
        }


        this.steps = ui.order - event.state.order;
        if (now[0] != old[0]) { // Main module changed
            if (!this.force && this.changed()) {
                this.onUnsaved();
                window.history.go(this.steps);
                this.discardSteps = this.steps;
                this.unsaved = true;
                return;
            }
            var f = function () {
                if (this.activeClass) {
                    document.getElementById(old[0]).classList.remove(this.activeClass);
                    document.getElementById(now[0]).classList.add(this.activeClass);
                }
                this.reconstruct();
            }
        } else {
            if (old.length > now.length) { // Went back
                if (old.length > 2) {
                    for (var i = old.length - 2; i > now.length - 1; i = i - 2) {
                        if (!this.force && this.modules[old[i]].class().changed()) {
                            this.onUnsaved();
                            window.history.go(this.steps);
                            this.discardSteps = this.steps;
                            this.unsaved = true;
                            return;
                        }
                    }
                } else {
                    if (!this.force && this.main.class().changed()) {
                        this.onUnsaved();
                        window.history.go(this.steps);
                        this.discardSteps = this.steps;
                        this.unsaved = true;
                        return;
                    }
                }
                switch (now.length) {
                    case 2:
                        var f = function () {
                            this.show(now[0]);
                            if (now[1] != 0) {
                                this.modules[now[0]].onSee();
                            } else {
                                this.modules[now[0]].onAdd();
                            }
                            this.welcomeAnimation();
                        }
                        break;
                    case 1:
                        var f = function () {
                            var input = document.getElementById(this.searchInput).value;
                            if (input.length === 0) {
                                this.modules[now[0]].class().list(this.listPage, this.listOrder, this.listDesc);
                            } else {
                                this.modules[now[0]].class().filter(input, this.listPage, this.listOrder, this.listDesc);
                            }
                            this.show(now[0]);
                            this.modules[now[0]].onList();
                        }
                        break;
                    default:
                        var f = function () {
                            this.show(now[now.length - 2]);
                            if (now[now.length - 1] != 0) {
                                this.modules[now[now.length - 2]].onSee();
                            } else {
                                this.modules[now[now.length - 2]].onAdd();
                            }
                            this.welcomeAnimation();
                        }
                        break;
                }
            } else if (old.length == 1) { // Going back with the same main module
                var f = function () {
                    this.reconstruct();
                }
            } else { // Going forward
                switch (now.length) {
                    case 2:
                        var f = function () {
                            if (now[1] != 0) {
                                this.modules[now[0]].class().see(now[1]);
                                this.modules[now[0]].onSee();
                            } else {
                                this.modules[now[0]].class().add();
                                this.modules[now[0]].onAdd();
                            }
                        }
                        break;
                    case 1:
                        var f = function () {
                            var input = document.getElementById(this.searchInput).value;
                            if (input.length === 0) {
                                this.modules[now[0]].class().list(this.listPage, this.listOrder, this.listDesc);
                            } else {
                                this.modules[now[0]].class().filter(input, this.listPage, this.listOrder, this.listDesc);
                            }
                            active.onList();
                        }
                        break;
                    default:
                        var f = function () {
                            var active = this.modules[now[now.length - 2]];
                            var edit = now[now.length - 1];
                            this.show(now[now.length - 2]);
                            if (edit != 0) {
                                active.class().see(edit);
                                active.onSee();
                            } else {
                                active.class().add();
                                active.onAdd();
                            }
                            this.welcomeAnimation();
                        }
                        break;
                }
            }
        }

        this.animationStart = performance.now();
        this.dismissAnimation();

        setTimeout(function () {
            this.onSection();
            f.bind(this)();
        }.bind(this), this.animationTime);

        this.state = now;
        this.order = event.state.order;
        document.title = event.state.title;
        this.force = false;
        this.discardSteps = 0;
    }

    /** 
     * Verify if the modules on display have unsaved changes
     * @returns {boolean} - True if everything is saved
    */
    changed() {
        if (this.state.length == 1) return false;
        for (var i = 0; i < this.state.length; i = i + 2) {
            try {
                if (this.modules[this.state[i]].class().changed()) return true;
            } catch (e) {
                console.log(e);
            }
        }
        return false;
    }


    //////// NAVIGATION ////////

    /**
     * If unsaved, call this method to discard changes (from the unsaved modal)
     */
    discard() {
        this.force = true;
        this.state = this.section();
        window.history.go(-this.discardSteps);
    }

    /**
     * To properly handle the refresh methods, call save()
     */
    save() {
        if ((performance.now() - this.lastchange) < 1000) return;
        this.lastchange = performance.now();
        var path = this.section();
        this.modules[path[path.length - 2]].class().save(function (id) {
            if (path.length > 2) {
                if (path[path.length - 1] != 0) {
                    for (var i = path.length - 4; i >= 0; i = i - 2) {
                        this.modules[path[i]].class().refresh(path[path.length - 2], id);
                    }
                } else { // If new one is created refresh only parent module
                    this.modules[path[path.length - 4]].class().refresh(path[path.length - 2], id);
                }
                ui.force = true;
                window.history.go(-1);
            } else {
                if (path[path.length - 1] < 1) {
                    path[path.length - 1] = id
                    this.replaceSection(path);
                }

                this.animationStart = performance.now();
                this.dismissAnimation();

                setTimeout(function () {
                    this.onSection();
                    this.main.class().see(id);
                }.bind(this), this.animationTime);
            }
        }.bind(this));
    }

    /**
     * When jumping between main sections you should use this method to add all the previous steps to the history
     * @param {string[]} path - Path to go to
     */
    link(path) {
        if (this.activeClass) {
            document.getElementById(this.state[0]).classList.remove(this.activeClass);
            document.getElementById(path[0]).classList.add(this.activeClass);
        }
        this.setSection([path[0]]);
        if (path.length > 1) {
            this.pushSection([path[1]]);
            for (var i = 2; i < path.length; i = i + 2) {
                this.pushSection([path[i], path[i + 1]]);
            }
        }
        this.animationStart = performance.now();
        this.dismissAnimation();

        setTimeout(function () {
            this.onSection();
            this.reconstruct();
        }.bind(this), this.animationTime);
    }


    //////// PATH ////////

    /**
     * Returns the current location parsed in an array.
     * @returns {string[]} - Array containing the current URL path
    */
    section() {
        var location = window.location.pathname.substring(1).split("/");
        if (location[location.length - 1] === "") {
            location.pop();
        }
        return location;
    }

    /**
     * Force the URL to be the specified section by replacing the current state (does not draw anything until reconstruct is called).
     * @param {string[]} path - Array containing the path to use
    */
    replaceSection(path) {
        path = path.filter(entry => entry !== ""); //beware those empty
        var url = window.location.origin;
        path.forEach((n) => {
            url += "/" + n;
        });
        var title = this.onTitle(path);
        document.title = title;
        history.replaceState({
            order: this.order,
            session: this.session,
            title: title
        }, title, url);
        this.state = path;
    }

    /**
     * Adds to the URL the new path (does not draw anything until reconstruct is called).
     * @param {string[]} path - Array containing the path to add
    */
    pushSection(path) {
        this.order++;
        path = path.filter(entry => entry !== ""); //beware those empty
        var url = window.location.href;
        path.forEach((n) => {
            url += "/" + n;
        });
        path = this.section().concat(path);
        var title = this.onTitle(path);
        document.title = title;
        history.pushState({
            order: this.order,
            session: this.session,
            title: title
        }, title, url);
        this.state = path;
    }

    /**
     * Force the URL to be the specified section by pushing it as a new state (does not draw anything until reconstruct is called).
     * @param {string[]} path - Array containing the path to use
    */
    setSection(path) {
        this.order++;
        path = path.filter(entry => entry !== ""); //beware those empty
        var url = window.location.origin;
        path.forEach((n) => {
            url += "/" + n;
        });
        var title = this.onTitle(path);
        document.title = title;
        history.pushState({
            order: this.order,
            session: this.session,
            title: title
        }, title, url);
        this.state = path
    }


    //////// MAIN ////////

    /**
     * Reconstruct the UI based on the current section (stored in the URL).
    */
    reconstruct() {
        this.listPage = 1;
        this.listOrder = "id";
        this.listDesc = true;

        var section = this.section();
        if (!this.order) { // Application is loading for the first time
            if (!section.length) section = this.defaultPath;

            // Verify that the url is correct, if not replace with default one and call onInvalidURL
            var modules = Object.keys(ui.modules);
            if (!modules.includes(section[0])) {
                section = this.defaultPath;
                this.onInvalidURL();
            } else {
                for (var i = 2; i < section.length; i = i + 2) {
                    if (!modules.includes(section[i])) {
                        section = this.defaultPath;
                        this.onInvalidURL();
                        break;
                    }
                }
            }

            this.replaceSection([section[0]]);
            if (section.length > 1) {
                this.pushSection([section[1]]);
                for (var i = 2; i < section.length; i = i + 2) {
                    this.pushSection([section[i], section[i + 1]]);
                }
            }
            if (this.activeClass) {
                document.getElementById(this.defaultPath[0]).classList.remove(this.activeClass);
                document.getElementById(section[0]).classList.add(this.activeClass);
            }

            this.onSection();
        }

        // Load all the submodules (nested dependencies) to have a simple list
        this.main = this.modules[section[0]];
        this.main.submodules = [];
        this.loadSubmodules(section[0]);

        // Clean stuff and create each module's viewport
        if (this.searchInput) document.getElementById("searchInput").value = null;
        document.getElementById("grid").innerHTML = "";
        this.main.submodules.forEach((n) => { //create viewport (div) for each submodule
            let element = document.createElement("div");
            element.id = this.modules[n].grid;
            document.getElementById("grid").appendChild(element);
        });

        // Call each module to display stuff 
        if (section.length > 1) {
            for (var i = 0; i < section.length; i = i + 2) {
                if (this.isSee(section[i + 1])) {
                    this.modules[section[i]].class().see(section[i + 1]);
                } else {
                    this.modules[section[i]].class().add();
                }
            }
            this.show(section[section.length - 2]);
            if (this.isSee(section[section.length - 1])) {
                this.modules[section[i - 2]].onSee();
            } else {
                this.modules[section[i - 2]].onAdd();
            }
        } else {
            this.main.class().list(this.listPage, this.listOrder, this.listDesc);
            this.show(section[0]);
            this.modules[section[0]].onList();
        }
    }

    /**
     * Function to call with onclick for sidebar menu. Loads the module's dependencies and cleans unused HTML. After animation it calls the list() method of the module
     * @param {string} module - Name of the module to load
    */
    load(module) {
        if (this.changed()) {
            this.setSection([module]);
            this.onUnsaved();
            window.history.go(-1);
            this.discardSteps = -1;
            this.unsaved = true;
            return;
        }

        if (this.activeClass) {
            document.getElementById(this.state[0]).classList.remove(this.activeClass);
            document.getElementById(module).classList.add(this.activeClass);
        }

        this.setSection([module]);

        this.animationStart = performance.now();
        this.dismissAnimation();

        setTimeout(function () {
            this.onSection();
            this.reconstruct();
        }.bind(this), this.animationTime);
    }

    /**
     * Draws or updated the module's grid with specified HTML after animation is complete. All modules should call this method to allow animations to blend in.
     * @param {string} grid - Id of the element to draw in (innerHTML)
     * @param {string} html - String containing the HTML to draw
     * @param {func} callback - After the HTML is drawn an before the welcome animation this method will be called (should be used to call functions that depend on the HTML to exist)
     */
    draw(grid, html, callback) {
        var elapsed = performance.now() - this.animationStart;
        if (elapsed < this.animationTime) { // Not enought time has passed to complete animation
            setTimeout(function () {
                document.getElementById(grid).innerHTML = html;
                if (callback != undefined) callback();
                if (this.animationCallback != null) this.animationCallback();
                this.animationCallback = null;
                if (this.drawCallback != null) this.drawCallback();
                this.welcomeAnimation();
            }.bind(this), this.animationTime - elapsed);
        } else { // The async request has taken longer than the animation. Draw now!
            document.getElementById(grid).innerHTML = html;
            if (callback != undefined) callback();
            if (this.animationCallback != null) this.animationCallback();
            this.animationCallback = null;
            if (this.drawCallback != null) this.drawCallback();
            this.welcomeAnimation();
        }
    }

    /**
     * Appends to this.main.submodules all the nested modules that main will need
     * @param {string} parent - Name of the module to load dependencies for
     */
    loadSubmodules(parent) {
        if (parent == null || parent == undefined) return;
        if (this.main.submodules.includes(parent)) return;
        this.main.submodules.push(parent);
        this.modules[parent].modules.forEach((n) => {
            if (n != parent) {
                this.loadSubmodules(n);
            }
        });
    }

    /**
     * Used as a link to go into some module data. It will call module.see(id) after animation is complete.
     * @param {string} module 
     * @param {string} id 
     */
    see(module, id, multiple) {
        if ((performance.now() - this.lastsee) < 500) return;
        if (multiple == undefined) this.lastsee = performance.now();
        if (id === null) id = 0;

        if (module == null) {
            module = this.section()[0];
            if (this.section().length == 1) this.pushSection([id]);
        } else {
            if (!this.main.submodules.includes(module)) throw new Error(`Module ${module} not loaded! Make sure to include it in modules array`);
            if (this.section().length > 1) {
                this.pushSection([module, id]);
            } else {
                this.pushSection([id]);
            }
        }

        this.animationStart = performance.now();
        this.dismissAnimation();

        setTimeout(function () {
            this.onSection();
            if (this.isSee(id)) {
                this.modules[module].class().see(id);
                this.modules[module].onSee();
            } else {
                this.modules[module].class().add();
                this.modules[module].onAdd();
            }
            this.show(module);
        }.bind(this), this.animationTime);
    }

    /**
     * Display the grid of the module and hide the rest
     * @param {string} module - Name of module to display
     */
    show(module) {
        this.main.submodules.forEach((n) => {
            var e = document.getElementById(this.modules[n].grid);
            e.style.display = "none";
        });
        var e = document.getElementById(this.modules[module].grid);
        e.style.display = "inline";
        e.style.visibility = "visible";
    }

    /**
     * Check if id is greater than 0 or different than "0" (which corresponds to the function see(id)
     * @param {any} id - Can be a number or a string contaning the element being seen
     */
    isSee(id) {
        return id != 0;
    }


    //////// LIST ////////

    /**
     * Returns the HTML of a pagination navbar with the current page and the total number of pages
     * @param {number} total 
     */
    listBar(total) {
        if (this.listBarHTML) {
            var args = [this.listPage, total];
            var i = 0;
            return this.listBarHTML.replace(/{}/g, function () {
                return typeof args[i] != "undefined" ? args[i++] : "";
            });
        }
    }

    /**
     * Go to next page in list
     */
    listNext() {
        document.body.scroll({ top: 0, left: 0, behavior: 'smooth' });
        this.listPage++;
        if (this.searchInput) {
            var input = document.getElementById("searchInput").value;
            if (input.length != 0) {
                this.main.class().filter(input, this.listPage, this.listOrder, this.listDesc);
                return;
            }
        }
        this.main.class().list(this.listPage, this.listOrder, this.listDesc);
    }

    /**
     * Go to previous page in list
     */
    listPrev() {
        document.body.scroll({ top: 0, left: 0, behavior: 'smooth' });
        this.listPage--;
        if (this.listPage < 1) this.listPage = 1;
        if (this.searchInput) {
            var input = document.getElementById("searchInput").value;
            if (input.length != 0) {
                this.main.class().filter(input, this.listPage, this.listOrder, this.listDesc);
                return;
            }
        }
        this.main.class().list(this.listPage, this.listOrder, this.listDesc);
    }

    /**
     * Should be used as a callback for the filter input (onchange or onkeyup)
    * @param {string} column - Order results by column. If undefined the default column is used. If the same as current column, then order is flipped.
     */
    filter(column) {
        document.body.scroll({ top: 0, left: 0, behavior: 'smooth' });
        if (column != undefined) {
            if (column === this.listOrder) {
                this.listDesc = !this.listDesc;
            } else {
                this.listOrder = column;
                this.listDesc = true;
            }
        }
        this.listPage = 1;
        var input = document.getElementById(this.searchInput).value;
        if (input.length === 0) {
            this.main.class().list(this.listPage, this.listOrder, this.listDesc);
        } else {
            this.main.class().filter(input, this.listPage, this.listOrder, this.listDesc);
        }
    }
}