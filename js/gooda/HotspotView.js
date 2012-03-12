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

require(["dojo/_base/declare",
         "dojo/on",
         "dijit/layout/ContentPane",
         "dijit/layout/BorderContainer",
         "dojox/widget/Standby"], function(declare, 
                                           on,
                                           ContentPane, 
                                           BorderContainer,
                                           StandBy){
  declare("GOoDA.HotspotView", GOoDA.DataView, {
    constructor: function(params){
      var self = this;
    
      declare.safeMixin(this, params);
      
      this.resourcesToLoad = 3;
      this.selection = {
        processID: 0,
        id: 0
      }
      this.bottomContainer = new BorderContainer({
        region: "center",
        splitter: true,
        style: "padding: 0"
      });
      
      this.container.addChild(this.bottomContainer);
      
      this.loadResource(this.fileLoader.getHotProcessData, 'HotProcessData');
      this.loadResource(this.fileLoader.getHotFunctionData, 'HotFunctionData');
      this.loadResource(this.fileLoader.getCGData, 'CGData', {processID: 0});
    },
    
    buildView: function(){
      if(this.HotProcessData === undefined || this.HotFunctionData === undefined || this.CGData === undefined)
        return;
      else if(this.HotProcessData === null || this.HotFunctionData === null)
        this.failure('Missing report data!');
      else{
        this.buildHotProcessView();
        this.buildHotFunctionView();
        this.buildCGView();
      }
    },
    
    buildHotProcessView: function(){
      var self = this;
      
      this.processContainer = new BorderContainer({
        title: "Hot Processes",
        region: "top",
        style: "height: 33%; padding: 0",
        splitter: true,
      });
      
      this.onResize(this.processContainer, function(){
        self.hotProcessView && self.hotProcessView.resize();
      })
      
      this.container.addChild(this.processContainer);
      this.report.addView(this.container);
      
      this.hotProcessView = new GOoDA.EventTable({
        container: self.processContainer,
        source: GOoDA.Columns.PROCESSPATH,
        data: self.HotProcessData,
        expand: true,
        
        rowCssClasses: function(d){
          return !d.parent ? " parent" : "";
        },
        
        codeHandler: function(target, e, row, cell, data, table){
          var criterias = {};
          var process;
          var paths;
          var module;
          var processID;

          if(!data)
            table.selectRows([]);
          else{
            processID = data.parent ? data.parent.id : data.id;
            process = data[GOoDA.Columns.PROCESSPATH] || data.parent[GOoDA.Columns.PROCESSPATH];
            
            table.selectRows([data]);
            
            if(data[GOoDA.Columns.MODULEPATH]){
              paths = data[GOoDA.Columns.MODULEPATH].split(/(\\|\/)/g);
              module = paths[paths.length - 1];
            }

            criterias[GOoDA.Columns.PROCESS] = process;
            criterias[GOoDA.Columns.MODULE] = module;
            
            if(self.selection.processID != processID){
              self.cgLoadScreen && self.cgLoadScreen.show();
                       
              self.loadResource(self.fileLoader.getCGData, 'CGData', {
                processID: data.id,
                success: function(data){
                  self._buildCGView(data);
                  self.cgLoadScreen.hide();
                },
                failure: function(){
                  self.cgLoadScreen.hide();
                  self.cgView.empty();
                }
              });
              
              self.selection.processID = processID;
            }
            
            if(self.selection.id != data.id && !self.hotFunctionView.getRow(self.selection.id)){
              self.unselect();
              self.selection.id = data.id;
            }
          }
          
          self.hotFunctionView && self.hotFunctionView.filter(criterias);
        }
        
      });     
      
      this.hotProcessView.toggleExpansion();
      delete this.HotProcessData;
      this.resourceProcessed();
    },
    
    buildHotFunctionView: function(){
      var self = this;
      
      this.functionContainer = new BorderContainer({
        title: "Hot Functions",
        region: "center",
        splitter: true,
        style: "padding: 0"
      });
      
      this.onResize(this.functionContainer, function(){
        self.hotFunctionView && self.hotFunctionView.resize();
      })
      
      this.bottomContainer.addChild(this.functionContainer);
      
      this.hotFunctionView = new GOoDA.EventTable({
        container: self.functionContainer,
        source: GOoDA.Columns.FUNCTIONNAME,
        data: self.HotFunctionData,
        
        codeHandler: function(target, e, row, cell, data, table){
          table.selectRows([data]);
          self.cgView && self.cgView.select(data.id);
        },

        altCodeHandler: function(target, e, row, cell, data){
          self._openFunctionView(data);
        }
      });

      delete this.HotFunctionData;
      this.resourceProcessed();
    },
    
    _openFunctionView: function(data){
      var processName = data[GOoDA.Columns.PROCESS];
      var functionName = data[GOoDA.Columns.FUNCTIONNAME];
      var functionView = null;
      
      if((functionView = this.report.getView(processName + functionName)))
        this.report.highlightView(functionView);
      else{
        new GOoDA.FunctionView({
          report: this.report,
          processName: processName,
          functionName: functionName,
          functionID: data.id
        });
      }
    },
    
    buildCGView: function(){
      var self = this;

      if(!this.CGData){
        this.resourceProcessed();
        return;
      }

      this.cgContainer = new BorderContainer({
        title: "Call Graph",
        style: "padding: 0; width: " + ($(this.bottomContainer.domNode).width()/2 - 2) + "px;",
        region: "right",
        splitter: true
      });

      this.onResize(this.cgContainer, function(){
        self.cgView && self.cgView.resize();
      });

      this.bottomContainer.addChild(this.cgContainer);
      
      this.cgLoadScreen = new dojox.widget.Standby({
        target: this.cgContainer.domNode,
        duration: 1,
        color: '#D3E1EB'
      });
      
      document.body.appendChild(this.cgLoadScreen.domNode);
      this.cgLoadScreen.startup();
      
      this._buildCGView(this.CGData);
      this.resourceProcessed();
      delete this.CGData;
    },
    
    _buildCGView: function(data){
      var self = this;
      
      if(this.cgView)
        this.cgView.reload(data);
      else{
        this.cgView = new GOoDA.GraphPane({
          container: self.cgContainer,
          svg: data,
          clickHandler: function(funID){
            var found = false;
            
            self.hotFunctionView.select(function(row){
              if(row.id == funID){
                found = true;
                return true;
              }else
                return false;
            });

            return found;
          },
          altClickHandler: function(id){
            self._openFunctionView(self.hotFunctionView.data.grid[id]);
          }
        });
      }
    },
    
    onLoaded: function(){
      this.hotProcessView && this.hotProcessView.select(function (row){
        return row.id === 0;        
      })
    },
    
    unselect: function(){
      this.hotFunctionView.unselect();
      this.cgView && this.cgView.unselect();
    },
    
    refresh: function(){
      this.hotFunctionView && this.hotFunctionView.refresh();
      this.hotProcessView && this.hotProcessView.refresh();
    },
  })
});