/****************************************************************************
 * Copyright 2021 EPAM Systems
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ***************************************************************************/

import {
  Pile,
  SgContexts,
  checkOverlapping,
  fromSeveralSgroupAddition,
  fromSgroupAction,
  fromSgroupDeletion,
  FunctionalGroup,
  SGroup
} from 'ketcher-core'

import { Editor } from '../Editor'
import LassoHelper from './helper/lasso'
import { isEqual } from 'lodash/fp'
import { selMerge } from './select'

const searchMaps = [
  'atoms',
  'bonds',
  'sgroups',
  'functionalGroups',
  'sgroupData'
]

class SGroupTool {
  editor: Editor
  type: any
  lassoHelper: any

  constructor(editor: Editor, type) {
    this.editor = editor
    this.type = type
    this.lassoHelper = new LassoHelper(1, editor)
    this.editor.selection(null)

    var sgroups = editor.render.ctab.molecule.sgroups
    var selectedAtoms = editor.selection()?.atoms
    const molecule = editor.render.ctab.molecule
    const struct = editor.render.ctab
    const newSelected = { atoms: [] as Array<any>, bonds: [] as Array<any> }
    let actualSgroupId
    let atomsResult: Array<any> = []
    let extraAtoms
    const functionalGroups = editor.render.ctab.molecule.functionalGroups
    const result: Array<any> = []

    var id = sgroups.find((_, sgroup) => isEqual(sgroup.atoms, selectedAtoms))

    if (selectedAtoms && functionalGroups.size) {
      for (let atom of selectedAtoms) {
        const atomId = FunctionalGroup.atomsInFunctionalGroup(
          functionalGroups,
          atom
        )
        if (atomId == null) extraAtoms = true
        const atomFromStruct = atomId !== null && struct.atoms.get(atomId)?.a

        if (atomFromStruct) {
          for (let sgId of atomFromStruct.sgs.values()) {
            actualSgroupId = sgId
          }
        }
        if (
          atomFromStruct &&
          FunctionalGroup.isAtomInContractedFinctionalGroup(
            atomFromStruct,
            sgroups,
            functionalGroups,
            false
          )
        ) {
          const sgroupAtoms =
            actualSgroupId !== undefined &&
            (SGroup.getAtoms(molecule, sgroups.get(actualSgroupId)) as any)
          const sgroupBonds =
            actualSgroupId !== undefined &&
            (SGroup.getBonds(molecule, sgroups.get(actualSgroupId)) as any)
          atom === sgroupAtoms[0] &&
            newSelected.atoms.push(...sgroupAtoms) &&
            newSelected.bonds.push(...sgroupBonds)
        }

        if (atomFromStruct) atomsResult.push(atomId)
      }
    }
    if (extraAtoms) atomsResult = []

    if (atomsResult && atomsResult.length > 0) {
      for (let id of atomsResult) {
        const fgId = FunctionalGroup.findFunctionalGroupByAtom(
          functionalGroups,
          id
        )
        if (fgId !== null && !result.includes(fgId)) result.push(fgId)
      }
    }

    if (result.length) {
      editor.selection(null)
      editor.event.removeFG.dispatch({ fgIds: result })
      return
    }

    sgroupDialog(editor, id !== undefined ? id : null, type)
    return
  }

  mousedown(event) {
    const editor = this.editor
    const struct = editor.render.ctab
    const { molecule, sgroups } = struct
    const functionalGroups = molecule.functionalGroups

    const ci = editor.findItem(event, searchMaps, null)
    const atomResult: Array<any> = []
    const bondResult: Array<any> = []
    const result: Array<any> = []
    if (ci && functionalGroups.size && ci.map === 'atoms') {
      const atomId = FunctionalGroup.atomsInFunctionalGroup(
        functionalGroups,
        ci.id
      )
      const atomFromStruct = atomId !== null && struct.atoms.get(atomId)?.a
      if (
        atomFromStruct &&
        !FunctionalGroup.isAtomInContractedFinctionalGroup(
          atomFromStruct,
          sgroups,
          functionalGroups,
          true
        )
      )
        atomResult.push(atomId)
    }
    if (ci && functionalGroups.size && ci.map === 'bonds') {
      const bondId = FunctionalGroup.bondsInFunctionalGroup(
        molecule,
        functionalGroups,
        ci.id
      )
      const bondFromStruct = bondId !== null && struct.bonds.get(bondId)?.b
      if (
        bondFromStruct &&
        !FunctionalGroup.isBondInContractedFunctionalGroup(
          bondFromStruct,
          sgroups,
          functionalGroups,
          true
        )
      )
        bondResult.push(bondId)
    }
    if (ci && functionalGroups.size && ci.map === 'functionalGroups') {
      const sgroup = sgroups.get(ci.id)
      if (FunctionalGroup.isFunctionalGroup(sgroup?.item)) {
        editor.event.removeFG.dispatch({ fgIds: [ci.id] })
        return
      }
    }
    if (atomResult.length > 0) {
      for (let id of atomResult) {
        const fgId = FunctionalGroup.findFunctionalGroupByAtom(
          functionalGroups,
          id
        )
        if (fgId !== null && !result.includes(fgId)) {
          result.push(fgId)
        }
      }
      this.editor.event.removeFG.dispatch({ fgIds: result })
      return
    } else if (bondResult.length > 0) {
      for (let id of bondResult) {
        const fgId = FunctionalGroup.findFunctionalGroupByBond(
          molecule,
          functionalGroups,
          id
        )
        if (fgId !== null && !result.includes(fgId)) {
          result.push(fgId)
        }
      }
      this.editor.event.removeFG.dispatch({ fgIds: result })
      return
    }
    if (!ci)
      //  ci.type == 'Canvas'
      this.lassoHelper.begin(event)
  }

  mousemove(event) {
    if (this.lassoHelper.running(event))
      this.editor.selection(this.lassoHelper.addPoint(event))
    else this.editor.hover(this.editor.findItem(event, searchMaps, null))
  }

  mouseleave(event) {
    if (this.lassoHelper.running(event)) this.lassoHelper.end(event)
  }

  mouseup(event) {
    const editor = this.editor
    const struct = editor.render.ctab
    const { molecule, sgroups } = struct
    const functionalGroups = molecule.functionalGroups

    let ci = editor.findItem(event, searchMaps, null)
    const selected = editor.selection()
    let newSelected = { atoms: [] as Array<any>, bonds: [] as Array<any> }
    let actualSgroupId
    let atomsResult: any = []
    let extraAtoms
    let bondsResult: any = []
    let extraBonds
    const result: any = []

    if (
      ci &&
      ci.map === 'functionalGroups' &&
      functionalGroups.size &&
      FunctionalGroup.isContractedFunctionalGroup(ci.id, functionalGroups)
    )
      return

    if (selected && functionalGroups.size && selected.atoms) {
      for (let atom of selected.atoms) {
        const atomId = FunctionalGroup.atomsInFunctionalGroup(
          functionalGroups,
          atom
        )
        if (atomId == null) extraAtoms = true
        const atomFromStruct = atomId !== null && struct.atoms.get(atomId)?.a

        if (atomFromStruct) {
          for (let sgId of atomFromStruct.sgs.values()) {
            actualSgroupId = sgId
          }
        }
        if (
          atomFromStruct &&
          FunctionalGroup.isAtomInContractedFinctionalGroup(
            atomFromStruct,
            sgroups,
            functionalGroups,
            true
          )
        ) {
          const sgroupAtoms =
            actualSgroupId !== undefined &&
            (SGroup.getAtoms(
              molecule,
              struct.sgroups.get(actualSgroupId)?.item
            ) as any)
          const sgroupBonds =
            actualSgroupId !== undefined &&
            (SGroup.getBonds(
              molecule,
              sgroups.get(actualSgroupId)?.item
            ) as any)
          atom === sgroupAtoms[0] &&
            newSelected.atoms.push(...sgroupAtoms) &&
            newSelected.bonds.push(...sgroupBonds)
        }

        if (atomFromStruct) atomsResult.push(atomId)
      }
    }
    if (selected && functionalGroups.size && selected.bonds) {
      for (let bond of selected.bonds) {
        const bondId = FunctionalGroup.bondsInFunctionalGroup(
          molecule,
          functionalGroups,
          bond
        )
        if (bondId === null) extraBonds = true
        const bondFromStruct = bondId !== null && struct.bonds.get(bondId)?.b
        if (bondFromStruct) bondsResult.push(bondId)
      }
    }

    if (atomsResult.length) {
      atomsResult.forEach(id => {
        const fgId = FunctionalGroup.findFunctionalGroupByAtom(
          functionalGroups,
          id
        ) as number
        const sgroupAtoms = SGroup.getAtoms(
          molecule,
          struct.sgroups.get(fgId)?.item
        )
        newSelected.atoms.push(...sgroupAtoms)
      })
    }
    if (bondsResult.length) {
      bondsResult.forEach(id => {
        const fgId = FunctionalGroup.findFunctionalGroupByBond(
          molecule,
          functionalGroups,
          id
        ) as number
        const sgroupBonds = SGroup.getBonds(
          molecule,
          struct.sgroups.get(fgId)?.item
        )
        newSelected.bonds.push(...sgroupBonds)
      })
    }
    if (extraAtoms || extraBonds) {
      atomsResult = null
      bondsResult = null
    }
    if (atomsResult && atomsResult.length > 0) {
      for (let id of atomsResult) {
        const fgId = FunctionalGroup.findFunctionalGroupByAtom(
          functionalGroups,
          id
        )
        if (fgId !== null && !result.includes(fgId)) {
          result.push(fgId)
        }
      }
    }
    if (bondsResult && bondsResult.length > 0) {
      for (let id of bondsResult) {
        const fgId = FunctionalGroup.findFunctionalGroupByBond(
          molecule,
          functionalGroups,
          id
        )
        if (fgId !== null && !result.includes(fgId)) {
          result.push(fgId)
        }
      }
    }
    if (result.length === 1) {
      this.editor.selection(null)
      this.lassoHelper.cancel()
      this.editor.event.removeFG.dispatch({ fgIds: result })
      return
    }
    var id = null // id of an existing group, if we're editing one
    var selection: any = null // atoms to include in a newly created group
    if (this.lassoHelper.running(event)) {
      // TODO it catches more events than needed, to be re-factored
      selection =
        newSelected.atoms.length > 0
          ? selMerge(this.lassoHelper.end(event), newSelected, false)
          : this.lassoHelper.end(event)
      this.editor.selection(selection)
    } else {
      if (!ci)
        // ci.type == 'Canvas'
        return
      this.editor.hover(null)

      if (ci.map === 'atoms') {
        // if we click the SGroup tool on a single atom or bond, make a group out of those
        selection = { atoms: [ci.id] }
      } else if (ci.map === 'bonds') {
        var bond = this.editor.render.ctab.bonds.get(ci.id)
        selection = { atoms: [bond?.b.begin, bond?.b.end] }
      } else if (ci.map === 'sgroups' || ci.map === 'sgroupData') {
        id = ci.id
      } else {
        return
      }
    }

    // TODO: handle click on an existing group?
    if (id !== null || (selection && selection.atoms))
      sgroupDialog(this.editor, id, this.type)
  }

  cancel() {
    if (this.lassoHelper.running()) this.lassoHelper.end()
    this.editor.selection(null)
  }
}

export function sgroupDialog(editor, id, defaultType) {
  const restruct = editor.render.ctab
  const struct = restruct.molecule
  const selection = editor.selection() || {}
  const sg = id !== null ? struct.sgroups.get(id) : null
  const type = sg ? sg.type : defaultType
  const eventName = type === 'DAT' ? 'sdataEdit' : 'sgroupEdit'

  if (!selection.atoms && !selection.bonds && !sg) {
    console.info('There is no selection or sgroup')
    return
  }

  let attrs: any = null
  if (sg) {
    attrs = sg.getAttrs()
    attrs.context = getContextBySgroup(restruct, sg.atoms)
  } else {
    attrs = {
      context: getContextBySelection(restruct, selection)
    }
  }

  const res = editor.event[eventName].dispatch({
    type,
    attrs
  })

  Promise.resolve(res)
    .then(newSg => {
      // TODO: check before signal
      if (
        newSg.type !== 'DAT' && // when data s-group separates
        checkOverlapping(struct, selection.atoms || [])
      ) {
        editor.event.message.dispatch({
          error: 'Partial S-group overlapping is not allowed.'
        })
      } else {
        if (
          !sg &&
          newSg.type !== 'DAT' &&
          (!selection.atoms || selection.atoms.length === 0)
        )
          return

        const isDataSg = sg && sg.getAttrs().context === newSg.attrs.context

        if (isDataSg) {
          const action = fromSeveralSgroupAddition(
            restruct,
            newSg.type,
            sg.atoms,
            newSg.attrs
          ).mergeWith(fromSgroupDeletion(restruct, id))

          editor.update(action)
          editor.selection(selection)
          return
        }

        const result = fromContextType(id, editor, newSg, selection)
        editor.update(result.action)
        editor.selection(null)
      }
    })
    .catch(() => null)
}

function getContextBySgroup(restruct, sgAtoms) {
  const struct = restruct.molecule

  if (sgAtoms.length === 1) return SgContexts.Atom

  if (manyComponentsSelected(restruct, sgAtoms)) return SgContexts.Multifragment

  if (singleComponentSelected(restruct, sgAtoms)) return SgContexts.Fragment

  const atomSet = new Pile(sgAtoms)

  const sgBonds = Array.from(struct.bonds.values()).filter(
    (bond: any) => atomSet.has(bond.begin) && atomSet.has(bond.end)
  )

  return anyChainedBonds(sgBonds) ? SgContexts.Group : SgContexts.Bond
}

function getContextBySelection(restruct, selection) {
  const struct = restruct.molecule

  if (selection.atoms && !selection.bonds) return SgContexts.Atom

  const bonds = selection.bonds.map(bondid => struct.bonds.get(bondid))

  if (!anyChainedBonds(bonds)) return SgContexts.Bond

  selection.atoms = selection.atoms || []

  const atomSet = new Pile(selection.atoms)
  const allBondsSelected = bonds.every(
    bond => atomSet.has(bond.begin) && atomSet.has(bond.end)
  )

  if (singleComponentSelected(restruct, selection.atoms) && allBondsSelected)
    return SgContexts.Fragment

  return manyComponentsSelected(restruct, selection.atoms)
    ? SgContexts.Multifragment
    : SgContexts.Group
}

function fromContextType(id, editor, newSg, currSelection) {
  const restruct = editor.render.ctab
  const sg = restruct.molecule.sgroups.get(id)
  const sourceAtoms = (sg && sg.atoms) || currSelection.atoms || []
  const context = newSg.attrs.context

  const result = fromSgroupAction(
    context,
    restruct,
    newSg,
    sourceAtoms,
    currSelection
  )

  result.selection = result.selection || currSelection

  if (id !== null && id !== undefined)
    result.action = result.action.mergeWith(fromSgroupDeletion(restruct, id))

  editor.selection(result.selection)

  return result
}

function anyChainedBonds(bonds) {
  if (bonds.length === 0) return true

  for (let i = 0; i < bonds.length; ++i) {
    const fixedBond = bonds[i]
    for (let j = 0; j < bonds.length; ++j) {
      if (i === j) continue

      const bond = bonds[j]

      if (fixedBond.end === bond.begin || fixedBond.end === bond.end)
        return true
    }
  }

  return false
}

function singleComponentSelected(restruct, atoms) {
  return countOfSelectedComponents(restruct, atoms) === 1
}

function manyComponentsSelected(restruct, atoms) {
  return (countOfSelectedComponents(restruct, atoms) as any) > 1
}

function countOfSelectedComponents(restruct, atoms) {
  const atomSet = new Pile(atoms)

  return Array.from(restruct.connectedComponents.values()).reduce(
    (acc: any, component: any) => acc + (atomSet.isSuperset(component) ? 1 : 0),
    0
  )
}

export default SGroupTool