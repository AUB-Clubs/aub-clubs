import { gql } from "graphql-request"

export const activeTrackQuery = gql`
  query GetActiveTrackConfiguration {
    trackManager {
      activeTrackConfig {
        id
        name
      }
    }
  }
`

export const wholeTrackQuery = gql`
query GetFullTrackConfigWithWaypoints($trackId: TrackCfgId!) {
    trackManager {
      getTrackConfigVersion(trackId: $trackId) {
        # All waypoints/nodes in the track
        nodes {
          nodeId
          name
          nodeType  # WAYPOINT, DOCK, CHARGING_STATION, etc.
          neighborIds  # Connected waypoints
        }
        
        # All edges/connections between waypoints
        edges {
          edgeId
          name
          startNodeId
          endNodeId
          bidirectional
        }
        
        # Optional station groupings
        stations {
          name
          nodeIds
          edgeIds
        }
      }
    }
  }
`

export const agvStateQuery = gql`
  query GetAgvStates($nextN: Int!, $cursor: String!) {
    agvQueries {
      listCompositeAgvState(nextN: $nextN, cursor: $cursor) {
        cursor
        more
        results {
          id
          controlState {
            currentWaypointId
            currentEdgeId
          }
        }
      }
    }
  }
`

export const availableScriptsQuery = gql`
  query GetAllAvailableScripts($nextN: Int!, $cursor: String!) {
    scriptProvisioning {
      availableLatestScriptConfigs(cursor:$cursor, nextN:$nextN) {
        cursor
        count
        more
        results {
          name
        }
      }
    }
  }
`

export const scriptMutation = gql`
  mutation CreateScriptConfig($scriptConfig: ScriptConfigInput!) {
    scriptProvisioning {
      createScriptConfig(scriptConfig: $scriptConfig) {
        id
        name
        description
        uri
        writerVersion
        knownIncompatibleWithReader
        created
        createdBy
      }
    }
  }
`

export const activateScriptMutation = gql`
  mutation ActivateScriptOnAgv($scriptId: ScriptCfgId!) {
    scriptProvisioning {
      activateScriptConfig(scriptId: $scriptId) {
        id
        name
        uri
        description
        writerVersion
        knownIncompatibleWithReader
        created
        createdBy
      }  
    }
  }
`

export const deactivateScriptMutation = gql`
  mutation DeactivateScriptOnAgv($scriptId: ScriptId!) {
    scriptProvisioning {
      deactivateScriptConfig(scriptId: $scriptId)
    }
  }
`
export const scriptLogsQuery = gql`
  query GetScriptLogs($scriptId: ScriptId!) {
    scriptQueries {
      getScriptWorkloadLogs(id: $scriptId)
    }
  }
`

export const activeScriptConfigQuery = gql`
  query GetActiveScriptConfig($scriptName: ScriptId!) {
    scriptProvisioning {
      activeScriptConfig(name: $scriptName) {
        id
        name
        uri
        description
        created
        createdBy
      }
    }
  }
`

