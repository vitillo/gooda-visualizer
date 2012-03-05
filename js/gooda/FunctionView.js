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
         "dijit/layout/ContentPane",
         "dijit/layout/BorderContainer",
         "dojox/html/entities"], function(declare, 
                                          ContentPane, 
                                          BorderContainer,
                                          entities){
  declare("GOoDA.FunctionView", GOoDA.DataView, {
    constructor: function(params){
      var self = this;
    
      declare.safeMixin(this, params);
      
      this.resourcesToProcess = 3;
      this.container.closable = true;
      this.container.name = this.processName + this.functionName;
      this.container.title = (this.functionName.length > 25) 
                             ? this.container.title = '<div title="' + entities.encode(this.functionName) + '">' + entities.encode(this.functionName.substr(0, 22)) + '...</div>' 
                             : this.functionName;
      
      this.loadResource(this.fileLoader.getASMData, 'ASMData');
      this.loadResource(this.fileLoader.getSRCData, 'SRCData');
      this.loadResource(this.fileLoader.getCFGData, 'CFGData');
    },
    
    buildView: function(){
      if(this.ASMData === undefined || this.SRCData === undefined || this.CFGData === undefined)
        return;

      this.buildASMPane();
      this.buildSRCPane();
      this.buildCFGPane();
    },
    
    buildASMPane: function(){
      var self = this;
      var title;
      
      if(!this.ASMData){
        this.failure('Report data for selected function not available.');
        return;
      }
      
      this.asmContainer = new BorderContainer({
        title: "Assembly Inspector",
        region: "center",
        style: "padding: 0",
        splitter: true
      });
      
      this.onResize(this.asmContainer, function(){
        self.asmView && self.asmView.resize();
      });

      this.container.addChild(this.asmContainer);
      this.report.addView(this.container);
      
      this.asmView = new GOoDA.EventTable({
        container: self.asmContainer,
        source: 'Disassembly',
        data: self.ASMData,
        tree: true,
        expand: true,
        
        rowCssClasses: function(d){ 
          return !d.parent ? " parent" : "";
        },
        
        codeHandler: function(target, e, row, cell, item, table){           
          if(item['parent']) return;
          table.selectRows([item]);
          
          if(self.cfgView){
            self.cfgView.select('node' + item[GOoDA.Columns.DISASSEMBLY].split(' ')[3]);
          }
          
          if(self.srcView){
            self.srcView.select(function(row){
              return (row[GOoDA.Columns.LINENUMBER] === item[GOoDA.Columns.PRINCIPALLINENUMBER]);
            })
          }
        },
      });

      this.sourceLines = this.ASMData.sourceLines;
      this.highlightedASMRow = this.ASMData.maxRow;
      delete this.ASMData;
      self.resourceProcessed();
    },
    
    buildSRCPane: function(){
      var self = this;
      
      if(!this.SRCData){
        this.resourceProcessed();
        return;
      }
      
      this.srcContainer = new BorderContainer({
        title: "Source Inspector",
        region: "right",
        splitter: true,
        style: "padding: 0; width: " + ($(this.container.domNode).width()/2 - 6) + "px;"
      });
      
      this.onResize(this.srcContainer, function(){
        self.srcView && self.srcView.resize();
      });
      
      this.container.addChild(this.srcContainer);
    
      self.srcView = new GOoDA.EventTable({
        container: self.srcContainer,
        source: 'Source',
        data: self.SRCData,
        
        rowCssClasses: function(d){ return d.highlight ? " parent" : "";},
        codeHandler: function(target, e, row, cell, item, table){
          if(!item.highlight) return;

          var selection = self.asmView.select(function(row){
            return !row.parent && row[GOoDA.Columns.PRINCIPALLINENUMBER] == item[GOoDA.Columns.LINENUMBER];
          }, true);
          
          if(selection){
            table.selectRows([item]);
            if(!self.cfgView) return;
            
            for(var i = 0; i < selection.length; i++)
              self.cfgView.select('node' + selection[i][GOoDA.Columns.DISASSEMBLY].split(' ')[3], i !== 0);
          }
        }
      });
      
      if(self.sourceLines){
        self.srcView.eachRow(function(row){
          if(row[GOoDA.Columns.LINENUMBER] in self.sourceLines){
            row.highlight = true;
          }
        });
      }
      
      delete self.SRCData;
      self.resourceProcessed();
    },
    
    buildCFGPane: function(){
      var self = this;
      
      if(!this.CFGData){
        this.resourceProcessed();
        return;
      }
      
      this.cfgContainer = new ContentPane({
        title: "Control Flow Graph",
        style: "height: 30%; width: 100%; padding: 0; overflow: hidden",
        region: "bottom",
        splitter: true
      });

      this.onResize(this.cfgContainer, function(){
        self.cfgView && self.cfgView.resize();
      });
    
      this.container.addChild(this.cfgContainer);

      this.cfgView = new GOoDA.CFGPane({
        container: self.cfgContainer.domNode,
        svg: self.CFGData,
        clickHandler: function(bb){
          var selection = self.asmView.select(function(row){
            return !row.parent && row[GOoDA.Columns.DISASSEMBLY].indexOf('Basic Block ' + bb.substr(4)) != -1;
          });
          
          if(selection && self.srcView){
            self.srcView.select(function(row){
              return (row[GOoDA.Columns.LINENUMBER] === selection[GOoDA.Columns.PRINCIPALLINENUMBER])
            })
          }

          return selection;
        }
      });
      
      delete self.CFGData;
      self.resourceProcessed();
    },
    
    onLoaded: function(){
      var item = this.highlightedASMRow;

      this.asmView && this.asmView.selectRows([item]);
      this.cfgView && this.cfgView.select('node' + item[GOoDA.Columns.DISASSEMBLY].split(' ')[3]);
      this.srcView && this.srcView.select(function(row){
          return (row[GOoDA.Columns.LINENUMBER] === item[GOoDA.Columns.PRINCIPALLINENUMBER]);
      });
    },
    
    refresh: function(){
      this.asmView && this.asmView.refresh();
      this.srcView && this.srcView.refresh();
    }
  })
});