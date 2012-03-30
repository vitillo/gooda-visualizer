/*
  Visualizer for the Generic Optimization Data Analyzer, Copyright (c)
  2012, The Regents of the University of California, through Lawrence
  Berkeley National Laboratory (subject to receipt of any required
  approvals from the U.S. Dept. of Energy).  All rights reserved.
  
  This code is derived from software contributed by Roberto Agostino 
  Vitillo <ravitillo@lbl.gov>.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are
  met:

  (1) Redistributions of source code must retain the above copyright
  notice, this list of conditions and the following disclaimer.

  (2) Redistributions in binary form must reproduce the above copyright
  notice, this list of conditions and the following disclaimer in the
  documentation and/or other materials provided with the distribution.

  (3) Neither the name of the University of California, Lawrence
  Berkeley National Laboratory, U.S. Dept. of Energy nor the names of
  its contributors may be used to endorse or promote products derived
  from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
  "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
  LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
  A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
  OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
  SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

require(["dijit/layout/BorderContainer",
         "dijit/layout/AccordionContainer",
         "dijit/layout/StackContainer",
         "dijit/layout/ContentPane",
         "dijit/Tree",
         "dijit/tree/ForestStoreModel",
         "dojox/data/CsvStore",
         "dojox/widget/Standby",
         "dojo/_base/declare"], function(BorderContainer,
                                         AccordionContainer, 
                                         StackContainer,
                                         ContentPane,
                                         Tree,
                                         ForestStoreModel,
                                         CsvStore,
                                         Standby,
                                         declare){
  declare("GOoDA.Visualizer", GOoDA.ContainerView, {
    constructor: function(params){
      var self = this;
      
      var reportStore = new CsvStore({
        identifier: 'report',
        label: 'report',
        urlPreventCache: true,
        url: "reports/index"
      });
      
      var reportModel = new ForestStoreModel({
        store: reportStore
      });
            
      this.state = new GOoDA.State({
        visualizer: this
      });
      
      this.viewport = new BorderContainer({
      }, "viewport");
      
      this.header = new ContentPane({
        region: "top",
        id: 'headerContainer',
        content: "<div id='header'>Generic Optimization Data Analyzer <div class='headerEm'>GUI</div></div>"
      });
      
      this.container = new StackContainer({
        region: 'center',
        splitter: true,
        style: "border: 0",
        id: 'workspace'
      });
      
      this.loadScreen = new dojox.widget.Standby({
          target: this.container.domNode,
          duration: 1,
          color: '#D3E1EB'
      });
  
      document.body.appendChild(this.loadScreen.domNode);

      this.navigationMenu = new AccordionContainer({
        region: 'left',
        splitter: true,
        id: "navigationMenu"
      });
      
      this.reportExplorer = new Tree({
        title: "Reports",
        model: reportModel,
        showRoot: false,
        persist: false,
        
        onClick: function(e){
          self.loadReport(e._csvId);
        }
      });
      
      // http://bugs.dojotoolkit.org/ticket/14554
      this.reportExplorer.containerNode = this.reportExplorer.domNode;
      
      this.navigationMenu.addChild(this.reportExplorer);
      this.viewport.addChild(this.header);
      this.viewport.addChild(this.navigationMenu);
      this.viewport.addChild(this.container);
      
      this.helpPane = new GOoDA.HelpPane({
        title: 'Help',
        parentContainer: this,
        navigationMenu: this.navigationMenu
      });
      
      this.viewport.startup();
      this.loadScreen.startup();
  
      if(!this.browserSupported())
        new GOoDA.Notification({
          title: 'Warning', 
          content: 'Browser version not supported, the application may not work as expected.'
        });
    },
    
    loadReport: function(name){
      var report = GOoDA.Report.create(name);
    },
    
    loadFunction: function(reportName, functionID){
      var functionView;
      GOoDA.Report.create(reportName, function(report){
        if((functionView = report.getView(report.name + functionID)))
          report.highlightView(functionView);
        else{
          new GOoDA.FunctionView({
            report: report,
            functionID: functionID
          });
        }
      });
    },
    
    showLoadScreen: function(){
      this.loadScreen.show();
    },
    
    hideLoadScreen: function(){
      this.loadScreen.hide();
    },
    
    browserSupported: function(){
      if(!Modernizr.inlinesvg) return false;
      if(!Modernizr.csstransforms) return false;
      if(Modernizr.touch) return false;
      return true;
    },
    
    restoreState: function(){
      this.state.restoreState();
    },
    
    gotoState: function(state, fresh){
      this.state.gotoState(state, fresh);
    },
    
    getState: function(){
      return this.state.getState();
    }
  });

  GOoDA.Visualizer.instance = null;
  GOoDA.Visualizer.getInstance = function(){
    if(!GOoDA.Visualizer.instance)
      GOoDA.Visualizer.instance = new GOoDA.Visualizer();
    
    return GOoDA.Visualizer.instance;
  }
});