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
         "dijit/Toolbar",
         "dijit/form/Button",
         "dijit/form/TextBox",
         "dijit/layout/ContentPane"], function(declare,
                                               Toolbar,
                                               Button,
                                               TextBox,
                                               ContentPane){
  declare("GOoDA.EventTable", null, {
    constructor : function(params){
      declare.safeMixin(this, params);

      var self = this;
      var sortcol = "";
      var sortdir = false;
      var searchString = "";
      var sampleMode = true;
      var cycleMode = true;
      var dataView = null;
      var data = []
      var grid = null;
      var collapsed = false;
      var selectedRow = undefined;
      var selectedRows = [];
      var criterias = null;

      var referencePeriod = this.data.referencePeriod;
      var inverseReferencePeriod = this.data.inverseReferencePeriod;

      var numberFormatter = function(row, cell, value, column, dataContext){
        if(!value) return '';

        if(column.isCycle){
          var cvalue;
          var referenceCycles = row >= 0 ? dataContext['unhalted_core_cycles'] : self.data.referenceCycles;

          if(sampleMode && cycleMode){
            cvalue = Math.floor(value*column.period*column.penalty*inverseReferencePeriod);

            if(referenceCycles)
              cvalue = buildField(column, cvalue, Math.floor(100*cvalue/referenceCycles));
            else
              cvalue = buildField(column, cvalue);
          }
          else if(sampleMode && !cycleMode){
            cvalue = value;

            if(!column.isHybrid && referenceCycles) 
              cvalue = buildField(column, cvalue, Math.floor(100*cvalue/referenceCycles));
            else if(!column.isHybrid)
              cvalue = buildField(column, cvalue);
          }
          else if(cycleMode){
            cvalue = (value*column.period*column.penalty).toExponential(3);

            if(referenceCycles)
              cvalue = buildField(column, cvalue, Math.floor(100*cvalue/(referenceCycles*referencePeriod)));
            else
              cvalue = buildField(column, cvalue);
          }else{
            cvalue = (value*column.period).toExponential(3);

            if(!column.isHybrid && referenceCycles) 
              cvalue = buildField(column, cvalue, Math.floor(100*cvalue/(referenceCycles*referencePeriod)));
            else if(!column.isHybrid)
              cvalue = buildField(column, cvalue);
          }

          return cvalue;
        }else
          return sampleMode ? value : (value*column.period).toExponential(3);
      };

      function buildField(column, cycles, percentage){
        percentage = percentage !== undefined ? " (" + percentage + "%)" : "";
        return cycles.toString() + new Array(column.maxPercentageLength + 5 - percentage.length).join(' ') + percentage;
      }

      var hexFormatter = function(row, cell, value, column, dataContext){
        if(row == -1) return value; // summary row
        if(value === undefined) return '';

        return '0x' + value.toString(16);
      }
      var sourceFormatter = function(row, cell, value, column, dataContext){
        return $('<div/>').text(value).html();
      };
      var treeFormatter = function(row, cell, value, column, dataContext) {     
        if(row == -1) return value;
        if(value === undefined) return '';

        if (dataContext.parent === undefined) {
          if (dataContext._collapsed)
            return "<span class='toggle expand'></span>" + value;
          else
            return "<span class='toggle collapse'></span>" + value;
        }
        else
          return "<span class='toggle'></span>" + value;
      };

      var toolbar = new Toolbar({
        region: 'top',
        style: "padding: 0"
      });
      
      var expandButton = new Button({
        label: 'Toggle Expansion',
        showLabel: false,
        iconClass: "dijitEditorIcon dijitEditorIconListBulletOutdent",
        onClick: function(){
          self.toggleExpansion();
        }
      });
      
      var unselectButton = new Button({
        label: 'Remove Selection',
        showLabel: false,
        iconClass: "dijitEditorIcon dijitEditorIconRemoveFormat",
        onClick: function(){
          toggleSelection();
        }
      });
      
      var cyclesButton = new Button({
        title: 'Cycles',
        label: 'Cycles',
        onClick: function(){
          toggleCycleMode(this);
        }
      });
      
      var samplesButton = new Button({
        title: 'Samples',
        label: 'Samples',
        onClick: function(){
          toggleSampleMode(this);
        }
      });
      
      var searchBox = new TextBox({
        placeHolder: 'Enter search term',
        style: 'float: right; margin: 2px',
        onKeyUp: function(){
          searchString = this.get('value');
          dataView.refresh();
          restoreSelectedRows();
        }
      });
      
      if(this.expand)
        toolbar.addChild(expandButton);
      if(this.unselect)
        toolbar.addChild(unselectButton);
      toolbar.addChild(cyclesButton);
      toolbar.addChild(samplesButton);
      toolbar.addChild(searchBox);
      
      var pane = new ContentPane({
        region: 'center',
        style: "padding: 0; margin-top: -6px"
      });
      
      this.container.addChild(toolbar);
      this.container.addChild(pane);
      this.container = pane.domNode;
      this.columns = [];
      this.options = {
        rowCssClasses: this.rowCssClasses,
        syncColumnCellResize: true,
        enableCellNavigation: false,
        enableColumnReorder: false,
      };

      function buildHTMLTable(){
        $('<div class="grid" style="width:100%;height:100%;"></div>').appendTo(self.container);
      }

      function comparer(a,b){
        var first = a.parent === undefined ? a : a.parent;
        var second = b.parent === undefined ? b : b.parent;
        var x = first[sortcol], y = second[sortcol];

        if(x == y)
          return sortdir ? (a.id > b.id ? 1 : -1) : (a.id > b.id ? -1 : 1)
        else
          return (x > y ? -1 : 1);
      }

      function filter(item) {
        if(criterias)
          for(var i in criterias)
            if(criterias[i] && item[i] != criterias[i]) 
              return false;

        if (searchString != "" && item[self.source] && item[self.source].indexOf(searchString) == -1)
          return false;

        if (item.parent !== undefined)
          if (item.parent._collapsed)
            return false;

        return true;
      }

      this.toggleExpansion = function(){
        collapsed = !collapsed;

        for(var i = 0; i < dataView.rows.length; i++){
          var item = dataView.rows[i];

          if(item.parent === undefined) item._collapsed = collapsed;
        }

        grid.scrollToRow(0);
        grid.invalidate();
        dataView.refresh();
        restoreSelectedRows();
      }

      function toggleSelection(){
        self.codeHandler(null, null, null, null, null, self);
      }

      function restoreSelectedRows(noscroll){
        var indices = []

        for(var i = 0; i < selectedRows.length; i++)
          indices.push(dataView.getRowById(selectedRows[i].id));

        grid.setSelectedRows(indices);
        if(!noscroll && indices.length) grid.scrollToRow(indices[0]);
      }

      function toggleCycleMode(button){
        cycleMode = !cycleMode;
        if(cycleMode){
          button.set('label', 'Cycles');
          button.set('title', 'Cycles');

          for(var i = 0; i < self.columns.length; i++){
            if(self.columns[i].cssClass == "eventLeaf" 
              && self.columns[i].name != GOoDA.Columns.UNHALTEDCYCLES
              && self.columns[i].name != GOoDA.Columns.STALLCYCLES){
              self.columns[i].cssClass = "cycleLeaf";
              self.columns[i].secondaryCssClass = "cycleLeaf";
            }
          }
        }
        else{
          button.set('label', 'Events');
          button.set('title', 'Events');

          for(var i = 0; i < self.columns.length; i++){
            if(self.columns[i].cssClass == "cycleLeaf" 
              && self.columns[i].name != GOoDA.Columns.UNHALTEDCYCLES
              && self.columns[i].name != GOoDA.Columns.STALLCYCLES){
              self.columns[i].cssClass = "eventLeaf";
              self.columns[i].secondaryCssClass = "eventLeaf";
            }
          }
        }

        grid.minimizeWidth();
        grid.invalidate();
      }

      function toggleSampleMode(button){
        sampleMode = !sampleMode;
        if(sampleMode){
          button.set('label', 'Samples');
          button.set('title', 'Samples');
        }else{
          button.set('label', 'Totals');
          button.set('title', 'Totals');
        }
        grid.minimizeWidth();
        grid.invalidate();
      }

      function cycleMode(){
        eventMode = false;
        cycleMode = true;
        grid.minimizeWidth();
        grid.invalidate();
      } 

      function eventMode(){
        eventMode = true;
        cycleMode = false;
        grid.minimizeWidth();
        grid.invalidate();
      }

      function wireEvents(){      
        grid.onClick = function(e, row, cell){
          var target = $(e.target);

          if (target.hasClass('toggle')) {
                      var item = dataView.rows[row];

                      if (item) {
                          if (!item._collapsed)
                              item._collapsed = true;
                          else
                              item._collapsed = false;

                          dataView.updateItem(item.id, item);
                          restoreSelectedRows(true);
                      }

                      return true;
                  }else if(self.codeHandler){
            self.codeHandler(target, e, row, cell, dataView.getRow(row), self);
            return true;
          }

          return false;
        }

        grid.onSort = function(sortCol, sortAsc) {
                  sortcol = sortCol.id;
                  sortdir = sortAsc;

                  if(sortcol == 'code')
            sortcol = 'id';

          dataView.sort(comparer,sortAsc);
          restoreSelectedRows();
              };

        dataView.onRowCountChanged.subscribe(function(args) {
          grid.updateRowCount();
                  grid.render();
        });

        dataView.onRowsChanged.subscribe(function(rows) {
          grid.removeRows(rows);
          grid.render();
        });

        if(!Modernizr.touch)
          $('.slick-row').live({
            mouseenter: function(){
              if(!$(this).hasClass('selected'))
                $(this).addClass('hover');
            },

            mouseleave: function(){
              $(this).removeClass('hover');
            }
          });
      }

      function addColumns(){
        for(var i = 0; i < self.data.columns.length; i++)
          addEventColumn(self.data.columns[i]);
      }

      function addEventColumn(column){
        $.extend(column, {flex: true, sortable: true});

        if(column.isEvent && column.isCycle && column.children.length)
          column.cssClass = column.secondaryCssClass = "cycleBranch";
        else if(column.isEvent && column.isCycle)
          column.cssClass = column.secondaryCssClass = "cycleLeaf";

        switch(column.id){
          case GOoDA.Columns.FUNCTIONNAME:
          case GOoDA.Columns.SOURCE:
            column.id = 'code';
            column.cssClass = 'code';
            column.formatter = sourceFormatter;
            column.resizable = true;
            break;

          case GOoDA.Columns.DISASSEMBLY:
          case GOoDA.Columns.PROCESSPATH:
            column.id = 'code';
            column.cssClass = 'code';
            column.formatter = treeFormatter;
            column.resizable = true;
            break;

          case GOoDA.Columns.OFFSET:
          case GOoDA.Columns.LENGTH:
          case GOoDA.Columns.ADDRESS:
            column.formatter = hexFormatter;
            break;

          case GOoDA.Columns.PRINCIPALLINENUMBER:
          case GOoDA.Columns.INITIALLINENUMBER:
          case GOoDA.Columns.LINENUMBER:
            break;

          case GOoDA.Columns.MODULE:
          case GOoDA.Columns.PROCESS:
          case GOoDA.Columns.PRINCIPALFILE:
          case GOoDA.Columns.INITIALFILE:
          case GOoDA.Columns.MODULEPATH:
            column.cssClass = 'names'
            column.resizable = true;
            break;

          default:
            column.formatter = numberFormatter;
            break;
        }

        self.columns.push(column);
      }

      function buildTable(){        
        dataView = new Slick.Data.DataView();
        grid = new Slick.Grid($('#' + self.container.getAttribute('widgetid') + ' .grid'), 
                       dataView.rows, self.columns, self.options);
        wireEvents();
      }

      function fillTable(){
        dataView.beginUpdate();
        dataView.setItems(self.data.grid);
        dataView.setFilter(filter);
        dataView.endUpdate();
      }

      this.refresh = function(){
        grid.restoreViewport();
        grid.render();
      }

      this.filter = function(crit){
        criterias = crit;
        dataView.setFilter(filter);
      }

      this.select = function(selector, multiple){
        var selection = [];

        for(var i = 0; i < dataView.rows.length; i++){
          if(selector(dataView.rows[i])){
            if(!multiple){
              this.selectRows([dataView.rows[i]]);
              return dataView.rows[i];
            }
            else
              selection.push(dataView.rows[i]);
          }
        }

        if(selection.length){
          this.selectRows(selection);
          return selection;
        }
        return null;
      }

      this.selectRows = function(rows){
        selectedRows = rows;
        restoreSelectedRows();
      }

      this.eachRow = function(fun){
        for(var i = 0; i < dataView.rows.length; i++)
          fun(dataView.rows[i]);

        grid.invalidate();
      }
      
      this.resize = function(){
        grid && grid.resizeCanvas();
      }

      buildHTMLTable();
      addColumns();
      buildTable();
      fillTable();
    }
  })
});