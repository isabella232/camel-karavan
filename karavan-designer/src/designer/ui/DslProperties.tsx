/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React from 'react';
import {
    Form,
    FormGroup,
    TextInput,
    Text,
    Title,
    Popover,
    Switch,
    NumberInput,
    Button,
    TextVariants, Select, SelectVariant, SelectDirection, SelectOption, TextArea, ExpandableSection
} from '@patternfly/react-core';
import '../karavan.css';
import "@patternfly/patternfly/patternfly.css";
import UndoIcon from "@patternfly/react-icons/dist/js/icons/backspace-icon";
import HelpIcon from "@patternfly/react-icons/dist/js/icons/help-icon";
import {Property} from "../model/KameletModels";
import {CamelElement, Expression, Integration} from "../model/CamelModel";
import {CamelApi} from "../api/CamelApi";
import {CamelApiExt} from "../api/CamelApiExt";
import {CamelMetadataApi, Languages, PropertyMeta} from "../api/CamelMetadata";
import {CamelYaml} from "../api/CamelYaml";
import {CamelUi} from "../api/CamelUi";
import {ComponentApi} from "../api/ComponentApi";
import {ComponentProperty} from "../model/ComponentModels";

interface Props {
    integration: Integration,
    step?: CamelElement,
    onIntegrationUpdate?: any,
    onPropertyUpdate?: any,
    onChangeView: any
}

interface State {
    integration: Integration,
    step?: CamelElement,
    element?: CamelElement,
    selectStatus: Map<string, boolean>
    isShowAdvanced: boolean
}

export class DslProperties extends React.Component<Props, State> {

    public state: State = {
        step: this.props.step,
        element: this.props.step ? CamelApi.elementFromStep(this.props.step) : undefined,
        integration: this.props.integration,
        selectStatus: new Map<string, boolean>(),
        isShowAdvanced: false
    };

    setView = (view: string) => {
        this.props.onChangeView.call(this, view);
    }

    onIntegrationChange = (field: string, value: string) => {
        let clone = new Integration({...this.state.integration});
        if (field === 'title') {
            clone.metadata.name = CamelUi.nameFomTitle(value);
            this.props.onIntegrationUpdate?.call(this, clone);
        }
    };

    propertyChanged = (fieldId: string, value: string | number | boolean | any) => {
        if (this.state.step && this.state.element) {
            const clone = CamelYaml.cloneStep(this.state.step);
            (clone as any)[this.state.element?.dslName][fieldId] = value;
            this.setStep(clone)
            this.props.onPropertyUpdate?.call(this, clone, this.state.step.uuid);
        }
    }

    expressionChanged = (language: string, value: string | undefined) => {
        if (this.state.step && this.state.element) {
            const clone = (CamelYaml.cloneStep(this.state.step));
            const e: any = {};
            e.language = language;
            e[language] = value;
            const exp: any = new Expression(e);
            if (this.state.element?.dslName === 'when'){
                (clone as any).expression = exp;
            } else {
                (clone as any)[this.state.element?.dslName].expression = exp;
            }
            this.setStep(clone);
            this.props.onPropertyUpdate?.call(this, clone, this.state.step.uuid);
        }
    }

    parametersChanged = (parameter: string, value: string | number | boolean | any, pathParameter?: boolean) => {
        if (this.state.step && this.state.element) {
            if (pathParameter){
                const uri = ComponentApi.buildComponentUri((this.state.element as any).uri, parameter, value);
                this.propertyChanged("uri", uri);
            } else {
                const clone = (CamelYaml.cloneStep(this.state.step));
                const parameters: any = {...(clone as any)[this.state.element?.dslName].parameters};
                parameters[parameter] = value;
                (clone as any)[this.state.element?.dslName].parameters = parameters;
                this.setStep(clone);
                this.props.onPropertyUpdate?.call(this, clone, this.state.step.uuid);
            }
        }

    };

    componentDidUpdate = (prevProps: Readonly<Props>, prevState: Readonly<State>, snapshot?: any) => {
        if (prevProps.step !== this.props.step) {
            this.setStep(this.props.step);
        }
    }

    setStep = (step?: CamelElement) => {
        this.setState({
            step: step,
            element: step ? CamelApi.elementFromStep(step) : undefined,
            selectStatus: new Map<string, boolean>()
        });
    }

    openSelect = (propertyName: string) => {
        this.setState({selectStatus: new Map<string, boolean>([[propertyName, true]])});
    }

    isSelectOpen = (propertyName: string): boolean => {
        return this.state.selectStatus.has(propertyName) && this.state.selectStatus.get(propertyName) === true;
    }

    getIntegrationHeader = (): JSX.Element => {
        return (
            <div className="headers">
                <Title headingLevel="h1" size="md">Integration</Title>
                <FormGroup label="Title" fieldId="title" isRequired>
                    <TextInput className="text-field" type="text" id="title" name="title" isReadOnly
                               value={
                                   CamelUi.titleFromName(this.state.integration.metadata.name)
                               }
                               onChange={e => this.onIntegrationChange('title', e)}/>
                </FormGroup>
                <FormGroup label="Name" fieldId="name" isRequired>
                    <TextInput className="text-field" type="text" id="name" name="name" isReadOnly
                               value={this.state.integration.metadata.name}/>
                </FormGroup>
            </div>
        )
    }

    getComponentHeader = (): JSX.Element => {
        const title = this.state.element && CamelUi.getTitle(this.state.element)
        const kamelet = this.state.element && CamelUi.getKamelet(this.state.element)
        const description = this.state.element && kamelet
            ? kamelet.spec.definition.description
            : this.state.element?.dslName ? CamelMetadataApi.getElementMeta(this.state.element?.dslName)?.description : title;
        return (
            <div className="headers">
                <Title headingLevel="h1" size="md">{title}</Title>
                <Text component={TextVariants.p}>{description}</Text>
            </div>
        )
    }

    createKameletProperty = (property: Property): JSX.Element => {
        const prefix = "parameters";
        const id = prefix + "-" + property.id;
        const value = CamelApiExt.getParametersValue(this.state.element, property.id);
        return (
            <FormGroup
                key={id}
                label={property.title}
                fieldId={id}
                labelIcon={
                    <Popover
                        position={"left"}
                        headerContent={property.title}
                        bodyContent={property.description}
                        footerContent={property.example ? "Example: " + property.example : undefined}>
                        <button type="button" aria-label="More info" onClick={e => e.preventDefault()}
                                className="pf-c-form__group-label-help">
                            <HelpIcon noVerticalAlign/>
                        </button>
                    </Popover>
                }>
                {property.type === 'string' && <TextInput
                    className="text-field" isRequired
                    type={property.format === 'password' ? "password" : "text"}
                    id={id} name={id}
                    value={value?.toString()}
                    onChange={e => this.parametersChanged(property.id, e)}/>
                }
                {property.type === 'boolean' && <Switch
                    id={id} name={id}
                    value={value?.toString()}
                    aria-label={id}
                    isChecked={Boolean(value) === true}
                    onChange={e => this.parametersChanged(property.id, !Boolean(value))}/>
                }
                {['integer', 'int', 'number'].includes(property.type) && <div className="number">
                    <NumberInput
                        className="number-property"
                        id={id} name={id}
                        value={typeof value === 'number' ? value : undefined}
                        inputName={id}
                        onMinus={() => this.parametersChanged(property.id, typeof value === 'number' ? value - 1 : -1)}
                        onPlus={() => this.parametersChanged(property.id, typeof value === 'number' ? value + 1 : 1)}
                        onChange={(e: any) => this.parametersChanged(property.id, Number(e.target.value))}/>
                    <Button
                        className="clear-button"
                        variant="tertiary"
                        isSmall icon={<UndoIcon/>}
                        onClick={e => this.parametersChanged(property.id, undefined)}/>
                </div>
                }
            </FormGroup>
        )
    }

    createComponentProperty = (property: ComponentProperty): JSX.Element => {
        const prefix = "parameters";
        const id = prefix + "-" + property.name;
        const value = CamelApiExt.getParametersValue(this.state.element, property.name, property.kind === 'path');
        const selectOptions: JSX.Element[] = []
        if (property.enum && property.enum.length > 0) {
            selectOptions.push(<SelectOption key={0} value={"Select ..."} isPlaceholder/>);
            property.enum.forEach(v => selectOptions.push(<SelectOption key={v} value={v}/>));
        }
        return (
            <FormGroup
                key={id}
                label={property.displayName}
                fieldId={id}
                isRequired={property.kind === 'path' || property.required}
                labelIcon={
                    <Popover
                        position={"left"}
                        headerContent={property.displayName}
                        bodyContent={property.description}
                        footerContent={property.defaultValue ? "Default: " + property.defaultValue : undefined}>
                        <button type="button" aria-label="More info" onClick={e => e.preventDefault()}
                                className="pf-c-form__group-label-help">
                            <HelpIcon noVerticalAlign/>
                        </button>
                    </Popover>
                }>
                {['string', 'duration'].includes(property.type) && property.enum === undefined && <TextInput
                    className="text-field" isRequired
                    type={property.secret ? "password" : "text"}
                    id={id} name={id}
                    value={value?.toString()}
                    onChange={e => this.parametersChanged(property.name, e, property.kind === 'path')}/>
                }
                {property.type === 'string' && property.enum && <Select
                    variant={SelectVariant.single}
                    aria-label={property.name}
                    onToggle={isExpanded => {
                        this.openSelect(property.name)
                    }}
                    onSelect={(e, value, isPlaceholder) => this.parametersChanged(property.name, (!isPlaceholder ? value : undefined), property.kind === 'path')}
                    selections={value?.toString()}
                    isOpen={this.isSelectOpen(property.name)}
                    aria-labelledby={property.name}
                    direction={SelectDirection.down}
                >
                    {selectOptions}
                </Select>
                }
                {property.type === 'boolean' && <Switch
                    id={id} name={id}
                    value={value?.toString()}
                    aria-label={id}
                    isChecked={Boolean(value) === true}
                    onChange={e => this.parametersChanged(property.name, !Boolean(value))}/>
                }
                {['integer', 'int', 'number'].includes(property.type) && <div className="number">
                    <NumberInput
                        className="number-property"
                        id={id} name={id}
                        value={value !== undefined ? (typeof value === 'number' ? value : Number(value)) : property.defaultValue}
                        inputName={id}
                        onMinus={() => this.parametersChanged(property.name, typeof value === 'number' ? value - 1 : Number(value) -1, property.kind === 'path')}
                        onPlus={() => this.parametersChanged(property.name, typeof value === 'number' ? value + 1 : Number(value) + 1, property.kind === 'path')}
                        onChange={(e: any) => this.parametersChanged(property.name, Number(e.target.value), property.kind === 'path')}/>
                    <Button
                        className="clear-button"
                        variant="tertiary"
                        isSmall icon={<UndoIcon/>}
                        onClick={e => this.parametersChanged(property.name, undefined,property.kind === 'path')}/>
                </div>
                }
            </FormGroup>
        )
    }

    createExpressionProperty = (property: PropertyMeta): JSX.Element => {
        const prefix = "language";
        const language = CamelApiExt.getExpressionLanguage(this.state.element) || 'Simple'
        const dslLanguage = Languages.find((l: [string, string, string]) => l[0] === language);
        const value = language ? CamelApiExt.getExpressionValue(this.state.element) : undefined;
        const selectOptions: JSX.Element[] = []
        // selectOptions.push(<SelectOption key={'placeholder'} value={"Select language"} isPlaceholder/>);
        Languages.forEach((lang: [string, string, string]) => {
            const s = <SelectOption key={lang[0]} value={lang[0]} description={lang[2]}/>;
            selectOptions.push(s);
        })
        return (
            <div>
                <FormGroup key={prefix + "-" + property.name} fieldId={property.name}>
                    <Select
                        variant={SelectVariant.typeahead}
                        aria-label={property.name}
                        onToggle={isExpanded => {
                            this.openSelect(property.name)
                        }}
                        onSelect={(e, lang, isPlaceholder) => this.expressionChanged(lang.toString(), value)}
                        selections={dslLanguage}
                        isOpen={this.isSelectOpen(property.name)}
                        aria-labelledby={property.name}
                        direction={SelectDirection.down}
                    >
                        {selectOptions}
                    </Select>
                </FormGroup>
                <FormGroup
                    key={property.name}
                    fieldId={property.name}
                    labelIcon={property.description ?
                        <Popover
                            position={"left"}
                            headerContent={property.displayName}
                            bodyContent={property.description}>
                            <button type="button" aria-label="More info" onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                                    className="pf-c-form__group-label-help">
                                <HelpIcon noVerticalAlign/>
                            </button>
                        </Popover> : <div></div>
                    }>
                    <TextArea
                        autoResize
                        className="text-field" isRequired
                        type={"text"}
                        id={property.name} name={property.name}
                        height={"100px"}
                        value={value?.toString()}
                        onChange={e => this.expressionChanged(language, e)}/>
                </FormGroup>
            </div>
        )
    }

    createElementProperty = (property: PropertyMeta): JSX.Element => {
        const value = this.state.element ? (this.state.element as any)[property.name] : undefined;
        const selectOptions: JSX.Element[] = []
        if (property.enumVals && property.enumVals.length > 0) {
            selectOptions.push(<SelectOption key={0} value={"Select " + property.name} isPlaceholder/>);
            selectOptions.push(...property.enumVals.split(',').map((value: string) =>
                <SelectOption key={value} value={value.trim()}/>));
        }
        return (
            <FormGroup
                key={property.name}
                label={CamelUi.capitalizeName(property.displayName)}
                fieldId={property.name}
                labelIcon={property.description ?
                    <Popover
                        position={"left"}
                        headerContent={property.displayName}
                        bodyContent={property.description}>
                        <button type="button" aria-label="More info" onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                                className="pf-c-form__group-label-help">
                            <HelpIcon noVerticalAlign/>
                        </button>
                    </Popover> : <div></div>
                }>
                {['string', 'duration'].includes(property.type) && !property.enumVals && <TextInput
                    isReadOnly={property.name === 'uri'}
                    className="text-field" isRequired
                    type={property.secret ? "password" : "text"}
                    id={property.name} name={property.name}
                    value={value?.toString()}
                    onChange={e => this.propertyChanged(property.name, e)}/>
                }
                {property.type === 'boolean' && <Switch
                    id={property.name} name={property.name}
                    value={this.state.element?.toString()}
                    aria-label={property.name}
                    isChecked={Boolean(value) === true}
                    onChange={e => this.propertyChanged(property.name, !Boolean(value))}/>
                }

                {property.enumVals &&
                <Select
                    variant={SelectVariant.single}
                    aria-label={property.name}
                    onToggle={isExpanded => {
                        this.openSelect(property.name)
                    }}
                    onSelect={(e, value, isPlaceholder) => this.propertyChanged(property.name, (!isPlaceholder ? value : undefined))}
                    selections={value}
                    isOpen={this.isSelectOpen(property.name)}
                    aria-labelledby={property.name}
                    direction={SelectDirection.down}
                >
                    {selectOptions}
                </Select>
                }
                {property.type === 'integer' && <div className="number">
                    <NumberInput
                        className="number-property"
                        id={property.name} name={property.name}
                        value={typeof value === 'number' ? value : undefined}
                        inputName={property.name}
                        onMinus={() => this.propertyChanged(property.name, typeof value === 'number' ? value - 1 : -1)}
                        onPlus={() => this.propertyChanged(property.name, typeof value === 'number' ? value + 1 : 1)}
                        onChange={(e: any) => this.propertyChanged(property.name, Number(e.target.value))}/>
                    <Button
                        className="clear-button"
                        variant="tertiary"
                        isSmall icon={<UndoIcon/>}
                        onClick={e => this.propertyChanged(property.name, undefined)}/>
                </div>
                }
                <div className="expression">
                    {property.name === 'expression' && property.type === "Expression"
                    && this.createExpressionProperty(property)}
                </div>
                <div className="parameters">
                    {property.name === 'parameters' && CamelUi.isKameletComponent(this.state.element)
                    && CamelUi.getKameletProperties(this.state.element).map(kp => this.createKameletProperty(kp))}

                    {property.name === 'parameters' && this.state.element && !CamelUi.isKameletComponent(this.state.element)
                    && CamelUi.getComponentProperties(this.state.element, false).map(kp => this.createComponentProperty(kp))}
                </div>
                {property.name === 'parameters' && this.state.element && !CamelUi.isKameletComponent(this.state.element) && (
                    <ExpandableSection
                        toggleText={'Advanced parameters'}
                        onToggle={isExpanded => this.setState({isShowAdvanced: !this.state.isShowAdvanced})}
                        isExpanded={this.state.isShowAdvanced}>
                        <div className="parameters">
                            {CamelUi.getComponentProperties(this.state.element, true).map(kp => this.createComponentProperty(kp))}
                        </div>
                    </ExpandableSection>
                )}
            </FormGroup>
        )
    }

    render() {
        return (
            <div key={this.state.step ? this.state.step.uuid : 'integration'} className='properties'>
                <Form autoComplete="off">
                    {this.state.element === undefined && this.getIntegrationHeader()}
                    {this.state.element && this.getComponentHeader()}
                    {this.state.element && CamelApiExt.getElementProperties(this.state.element.dslName).map((property: PropertyMeta) => this.createElementProperty(property))}
                </Form>
            </div>
        );
    }
};