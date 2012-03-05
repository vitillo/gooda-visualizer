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

(function() {   
    function SVGScrollView(){ this.initialize.apply(this, arguments) }
    SVGScrollView.prototype = {     
        initialize: function(container, options){
            var container = $(container);
            var svgDocument = container[0];
            var group = container.children().first()[0];

            var parent = container.parent();
            
            var viewbox = svgDocument.viewBox.baseVal;
            var bbox = group.getBBox();
            var isgrabbing = false;
            var oldX, oldY;
            var curTransX = 0, curTransY = 0;
            var oldSelection = [];
            var selectionColor = '#FFEBA4';
            var preHighlightColor = null;

            var width = parent.width();
            var height = parent.height();
            
            var minX = (bbox.width < width) ? - (width - bbox.width)/2 :  0;
            var minY = (bbox.height < height) ? - (height - bbox.height)/2 : 0;

            viewbox.width = width;
            viewbox.height = height;
            svgDocument.setAttribute('width', width + 'px');
            svgDocument.setAttribute('height', height + 'px');
            $('text', container).css('font-size', '12px')
            
            setGrab();
            scrollTo(minX, minY);
            zoom({x: parent.offset().left + width/2, y: parent.offset().top + height/2}, 0.8);

            function setGrab(){
                svgDocument.style.cursor = 'default';
                svgDocument.style.cursor = 'grab';
                svgDocument.style.cursor = '-moz-grab';
                svgDocument.style.cursor = '-webkit-grab';
            }

            function setGrabbing(){
                svgDocument.style.cursor = 'move';
                svgDocument.style.cursor = 'grabbing';
                svgDocument.style.cursor = '-moz-grabbing';
                svgDocument.style.cursor = '-webkit-grabbing';
            }

            function startgrab(){
                isgrabbing = true;
                setGrabbing()
            }
    
            function stopgrab(){
                isgrabbing = false;
                setGrab();
            }

            function setCTM(element, matrix) {
                var s = "matrix(" + matrix.a + "," + matrix.b + "," + matrix.c + "," + matrix.d + "," + matrix.e + "," + matrix.f + ")";
                element.setAttribute("transform", s);
            }

            function scrollTo(dx, dy){
                    var trans = svgDocument.createSVGMatrix().translate(-dx, -dy)
                    
                    curTransX += dx;
                    curTransY += dy;
                    setCTM(group, trans.multiply(group.getCTM()));
            }

            function selectNode(node, multiple){                    
                var poly = $('polygon', node);
                
                if(!multiple && oldSelection.length){
                    for(var i = 0; i < oldSelection.length; i++){
                        oldSelection[i].setAttribute('stroke-width', 1);
                        oldSelection[i].setAttribute('stroke-dasharray', null);
                    }
                    oldSelection = [];
                }

                poly[0].setAttribute('stroke-width', 3);
                poly[0].setAttribute('stroke-dasharray', '4');

                oldSelection.push(poly[0]);
            }
            
            this.resize = function(){
                width = parent.width();
                height = parent.height();
                
                viewbox.width = width;
                viewbox.height = height;
                svgDocument.setAttribute('width', width + 'px');
                svgDocument.setAttribute('height', height + 'px');
            }
        
            this.select = function(id, multiple){
                var bbox;
                var node = $('#' + id, group);
                var nodeCoord = svgDocument.createSVGPoint();
                var center = svgDocument.createSVGPoint();
                
                if(node.length === 0) return;
                selectNode(node, multiple);
                
                bbox = node[0].getBBox();
                nodeCoord.x = bbox.x + bbox.width/2;
                nodeCoord.y = bbox.y + bbox.height/2;
                nodeCoord = nodeCoord.matrixTransform(group.getCTM());
                
                center.x = width / 2;
                center.y = height / 2;
                
                //If already visible don't center it
                if(multiple || Math.abs(center.x - nodeCoord.x) < width / 2 && Math.abs(center.y - nodeCoord.y) < height / 2)
                    return;
                
                scrollTo(nodeCoord.x - center.x, nodeCoord.y - center.y);
            }
            
            function zoom(center, factor, relative){
                var p = svgDocument.createSVGPoint();
                var scale;
                
                if(relative){
                    p.x = center.x
                    p.y = center.y
                }else{
                    p.x = center.x - parent.offset().left;
                    p.y = center.y - parent.offset().top;
                }
                
                p = p.matrixTransform(group.getCTM().inverse());
                scale = svgDocument.createSVGMatrix().translate(p.x, p.y).scale(factor).translate(-p.x, -p.y);
                setCTM(group, group.getCTM().multiply(scale));
            }

            parent.mousedown(function(e){
                    startgrab();
                    oldX = e.pageX;
                    oldY = e.pageY;
                    return false;
            })
            .mousewheel(function(e, delta){
                var factor = delta < 0 ?  0.9 : 1.1;
                zoom({x: e.pageX, y: e.pageY}, factor)
                return false;
            });

            $(document).mousemove(function(e){
                    if (!isgrabbing) return true;

                    scrollTo(oldX - e.pageX, oldY - e.pageY);
                    oldX = e.pageX;
                    oldY = e.pageY;

                    return false;
            })
            .mouseleave(function(){ stopgrab(); return false; })
            .mouseup(function(){ stopgrab(); return false; });
            
            $(group).delegate('g.node', {
                mouseenter: function(){
                    preHighlightColor = this.childNodes[2].style.fill;
                    this.childNodes[2].style.fill = '#D6E4F5';
                },
                mouseleave: function(){
                    var poly = this.childNodes[2];
                    poly.style.fill = preHighlightColor;
                },
                click: function(){
                    if(options.clickHandler(this.id))
                        selectNode(this);                   
                }
            });
        }
    };
    
    jQuery.fn.SVGScrollView = function(){
        var args = arguments; 
        return this.each(function(){
            if(args[0] == 'select') this.svgscrollview.select(args[1], args[2]);
            else if(args[0] == 'resize') this.svgscrollview.resize(args[1], args[2]);
            else this.svgscrollview = new SVGScrollView(this, args[0]);
        });
    };
})(jQuery);