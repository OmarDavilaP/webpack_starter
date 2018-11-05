import React, {Component} from 'react';

class HeaderCollapse extends Component{

    constructor(){
        super();
    }

    render(){
        const {title} = this.props;
        return (
        <div id="people-db-container" className="card-container span8">
            <div className="card-container-header">
                    <div className="card-container-header-title">
                        <h3>{title}</h3>
                    </div>
                </div>
        </div>
        );
    }

}
export default HeaderCollapse;