import React, { PureComponent } from 'react';
import { TextField } from 'material-ui';
import { SelectField } from 'material-ui';
import { MenuItem } from 'material-ui';
import { RaisedButton } from 'material-ui';
import { Paper } from 'material-ui';
import { Toggle } from 'material-ui';
import autobind from 'autobind-decorator';
import { connect } from 'react-redux';
import { getLibrary, getConfiguration } from '../gameProvider';
import renderAfterModuleLoaded from '../hoc/renderAfterModuleLoaded';
import { topLevelPaperContainer } from '../styles';

const styles = {
    container: {
        ...topLevelPaperContainer,
    },
    newGameButtonContainer: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
};

@connect(state => ({
    user: state.user,
    users: state.users,
}))
@renderAfterModuleLoaded(() => ['/assets/games/configurations.js'])
@autobind
export default class NewGame extends PureComponent {
    state = {
        gameName: null,
        title: this.props.user.name + '\'s Game',
        players: [this.props.user.id],
        dirtyTitle: false,
        options: {},
        optionsErrors: {},
        error: null,
    };

    render() {
        const { gameName, title, players, dirtyTitle, options, error } = this.state;

        const config = gameName && getConfiguration(gameName, options, players.length);

        return (
            <Paper style={styles.container}>
                {error && <div>Error: {error}</div>}
                <SelectField
                    value={gameName}
                    floatingLabelText="Select Game"
                    onChange={this.onChangeGame}
                    fullWidth={true}
                >
                    {getLibrary().map(name =>
                        <MenuItem
                            key={name}
                            value={name}
                            primaryText={getConfiguration(name).name}
                        />
                    )}
                </SelectField>
                <TextField
                    floatingLabelText="Game Title"
                    value={title}
                    onChange={this.onChangeTitle}
                    fullWidth={true}
                    errorText={dirtyTitle && !title.length && 'You must set a title'}
                />
                {gameName && this.renderPlayers(config)}
                {gameName && this.renderOptions(gameName)}
                {gameName && title && players.length >= config.minPlayers &&
                <div style={styles.newGameButtonContainer}>
                    <RaisedButton
                        label="Create Game"
                        onTouchTap={this.onClickCreateGame.bind(this, config)}
                        primary={true}
                    />
                </div>
                }
            </Paper>
        );
    }

    renderPlayers(config) {
        const { players } = this.state;
        const { maxPlayers, minPlayers } = config;

        let retval = [];

        for (let i = 0; i < maxPlayers; i++) {
            if (players[i - 1] || i < minPlayers) {
                retval.push(
                    <SelectField
                        key={i}
                        value={players[i]}
                        floatingLabelText={`Player ${i + 1}`}
                        onChange={this.onChangePlayer.bind(this, i)}
                        fullWidth={true}
                        errorText={!players[i] && i < minPlayers && 'This player is required'}
                    >
                        {this.props.users
                            .filter(user => user.id === players[i] || players.indexOf(user.id) === -1)
                            .map(player => <MenuItem key={player.id} value={player.id} primaryText={player.name}/>)}
                    </SelectField>
                );
            }
        }

        return retval;
    }

    renderOptions(gameName) {
        const stateOptions = this.state.options;
        const stateErrors = this.state.optionsErrors;
        const { options } = getConfiguration(gameName, stateOptions, this.state.players.filter(p => p).length);

        if (!options) {
            return null;
        }

        return options.map(option => {
            const { type, name, label, disabled, items, validate } = option;
            const value = stateOptions[name];
            if (type === 'boolean') {
                return <Toggle
                    key={name}
                    toggled={value}
                    onToggle={(e, checked) => this.onChangeOption(name, checked, validate)}
                    disabled={disabled}
                    label={label}
                />;
            } else if (type === 'select') {
                return <SelectField
                    key={name}
                    value={value}
                    floatingLabelText={label}
                    onChange={(e, k, v) => this.onChangeOption(name, v, validate)}
                    errorText={stateErrors[name]}
                >
                    {items.map(({ value, label }) => <MenuItem key={value} value={value} primaryText={label}/>)}
                </SelectField>
            } else {
                return <TextField
                    key={name}
                    value={value}
                    onChange={e => this.onChangeOption(name, e.target.value, validate)}
                    disabled={disabled}
                    floatingLabelText={label}
                    errorText={stateErrors[name]}
                />;
            }
        });
    }

    onChangeGame(ev, i, gameName) {
        this.setState({ gameName });
    }

    onChangeTitle({ target: { value: title } }) {
        this.setState({
            title,
            dirtyTitle: true
        });
    }

    onChangePlayer(index, ev, key, value) {
        const newPlayers = this.state.players.slice();
        newPlayers[index] = value;
        this.setState({ players: newPlayers.filter(player => player) });
    }

    onChangeOption(option, value, validate) {
        this.setState({
            options: {
                ...this.state.options,
                [option]: value,
            },
        });

        if (validate) {
            validate({ value })
                .then(valid => this.setState({
                    optionsErrors: {
                        ...this.state.optionsErrors,
                        [option]: valid === true ? false : valid,
                    },
                }))
                .catch(err => this.setState({
                    optionsErrors: {
                        ...this.state.optionsErrors,
                        [option]: err,
                    },
                }));
        }
    }

    onClickCreateGame(config) {
        const { gameName: game, title, options } = this.state;
        const players = this.state.players.filter(player => player);

        this.setState({ dirtyTitle: true, error: null });

        if (!title) {
            return;
        } else if (players.length < config.minPlayers) {
            return;
        }

        const gameData = {
            game,
            title,
            players,
            options,
        };

        const { hooks = {} } = getConfiguration(game, options, players);
        const presubmit = hooks.presubmit || (() => Promise.resolve(gameData));

        presubmit(gameData).then(
            gameData => this.props.dispatch({
                type: 'CREATE_GAME',
                data: gameData
            }),
            error => this.setState({ error: error ? error.message || error.toString() : 'Error' })
        );
    }
}